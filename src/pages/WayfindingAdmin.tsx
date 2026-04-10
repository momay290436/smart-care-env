import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Trash2, MousePointer, Link2, Building2, Move, Eye, Route, ZoomIn, ZoomOut, Layers, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ---- Types ----
interface WNode { id: string; node_key: string; label: string; x: number; y: number; is_assembly_point: boolean; }
interface WEdge { id: string; from_node_key: string; to_node_key: string; weight: number | null; }
interface WBuilding { id: string; building_key: string; name: string; short_name: string; aliases: string[]; description: string; x: number; y: number; category: string; node_key: string; }
interface WRoute { id: string; from_building_key: string; to_building_key: string; node_path: string[]; description: string; }

type EditorMode = "select" | "add_node" | "add_edge" | "add_building" | "move";

interface LayerVisibility {
  nodes: boolean;
  edges: boolean;
  buildings: boolean;
  labels: boolean;
}

// ---- Queries ----
function useWayfindingData() {
  const nodes = useQuery({
    queryKey: ["wf-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_nodes").select("*").order("node_key");
      if (error) throw error;
      return data as WNode[];
    },
  });
  const edges = useQuery({
    queryKey: ["wf-edges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_edges").select("*");
      if (error) throw error;
      return data as WEdge[];
    },
  });
  const buildings = useQuery({
    queryKey: ["wf-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_buildings").select("*").order("building_key");
      if (error) throw error;
      return data as WBuilding[];
    },
  });
  const routes = useQuery({
    queryKey: ["wf-routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_routes").select("*").order("from_building_key");
      if (error) throw error;
      return data as WRoute[];
    },
  });
  return { nodes, edges, buildings, routes };
}

// ---- Visual Map Editor ----
function MapEditor({
  nodes, edges, buildings, mode, selectedNodeKey, selectedBuildingKey, edgeStart,
  onMapClick, onNodeClick, onBuildingClick, onNodeDrag, onBuildingDrag,
  layers, zoom, panOffset,
}: {
  nodes: WNode[]; edges: WEdge[]; buildings: WBuilding[];
  mode: EditorMode; selectedNodeKey: string | null; selectedBuildingKey: string | null; edgeStart: string | null;
  onMapClick: (x: number, y: number) => void;
  onNodeClick: (nodeKey: string) => void;
  onBuildingClick: (buildingKey: string) => void;
  onNodeDrag: (nodeKey: string, x: number, y: number) => void;
  onBuildingDrag: (buildingKey: string, x: number, y: number) => void;
  layers: LayerVisibility;
  zoom: number;
  panOffset: { x: number; y: number };
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.node_key, n])), [nodes]);
  const [dragging, setDragging] = useState<{ type: "node" | "building"; key: string } | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);

  const svgCoords = useCallback((e: React.MouseEvent | MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    // Reverse the zoom/pan transform
    const x = parseFloat(((rawX / zoom + panOffset.x)).toFixed(1));
    const y = parseFloat(((rawY / zoom + panOffset.y)).toFixed(1));
    return { x, y };
  }, [zoom, panOffset]);

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDraggingRef.current) return;
    const { x, y } = svgCoords(e);
    onMapClick(x, y);
  }, [onMapClick, svgCoords]);

  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = svgCoords(e);
    startPosRef.current = pos;
    isDraggingRef.current = false;
    setDragging({ type: "node", key: nodeKey });
    setDragPos(pos);
  }, [svgCoords]);

  const handleBuildingMouseDown = useCallback((e: React.MouseEvent, buildingKey: string) => {
    e.stopPropagation();
    e.preventDefault();
    const pos = svgCoords(e);
    startPosRef.current = pos;
    isDraggingRef.current = false;
    setDragging({ type: "building", key: buildingKey });
    setDragPos(pos);
  }, [svgCoords]);

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => {
      const pos = svgCoords(e as any);
      if (startPosRef.current) {
        const dx = Math.abs(pos.x - startPosRef.current.x);
        const dy = Math.abs(pos.y - startPosRef.current.y);
        if (dx > 0.5 || dy > 0.5) isDraggingRef.current = true;
      }
      setDragPos(pos);
    };
    const handleUp = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        const pos = svgCoords(e as any);
        if (dragging.type === "node") onNodeDrag(dragging.key, pos.x, pos.y);
        else onBuildingDrag(dragging.key, pos.x, pos.y);
      } else {
        if (dragging.type === "node") onNodeClick(dragging.key);
        else onBuildingClick(dragging.key);
      }
      setDragging(null);
      setDragPos(null);
      startPosRef.current = null;
      setTimeout(() => { isDraggingRef.current = false; }, 50);
    };
    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    return () => { window.removeEventListener("mousemove", handleMove); window.removeEventListener("mouseup", handleUp); };
  }, [dragging, svgCoords, onNodeDrag, onBuildingDrag, onNodeClick, onBuildingClick]);

  const getNodePos = (n: WNode) => {
    if (dragging?.type === "node" && dragging.key === n.node_key && dragPos) return dragPos;
    return { x: n.x, y: n.y };
  };
  const getBuildingPos = (b: WBuilding) => {
    if (dragging?.type === "building" && dragging.key === b.building_key && dragPos) return dragPos;
    return { x: b.x, y: b.y };
  };

  // Compute viewBox based on zoom and pan
  const vbW = 100 / zoom;
  const vbH = 100 / zoom;
  const viewBox = `${panOffset.x} ${panOffset.y} ${vbW} ${vbH}`;

  // Scale sizes inversely with zoom for consistent visual size
  const nodeRadius = 1.5 / zoom;
  const selectedRadius = 2.2 / zoom;
  const fontSize = 1.8 / zoom;
  const buildingSize = 3 / zoom;
  const strokeWidth = 0.5 / zoom;
  const buildingFontSize = 1.4 / zoom;

  return (
    <div className="relative w-full rounded-xl overflow-hidden border-2 border-border">
      <img src="/maps/buildings.jpg" alt="แผนที่" className="w-full h-auto block" draggable={false} />
      <svg
        ref={svgRef}
        viewBox={viewBox}
        className="absolute inset-0 w-full h-full cursor-crosshair"
        preserveAspectRatio="none"
        onClick={handleClick}
      >
        {/* Edges */}
        {layers.edges && edges.map((edge, i) => {
          const n1 = nodeMap.get(edge.from_node_key);
          const n2 = nodeMap.get(edge.to_node_key);
          if (!n1 || !n2) return null;
          const p1 = getNodePos(n1);
          const p2 = getNodePos(n2);
          return (
            <line key={i} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
              stroke="hsl(200 80% 50%)" strokeWidth={strokeWidth} opacity="0.5" strokeDasharray={`${strokeWidth * 2} ${strokeWidth}`} />
          );
        })}

        {/* Nodes */}
        {layers.nodes && nodes.map((node) => {
          const pos = getNodePos(node);
          const isDragged = dragging?.type === "node" && dragging.key === node.node_key;
          const isSelected = selectedNodeKey === node.node_key;
          return (
            <g key={node.node_key}
              onMouseDown={(e) => handleNodeMouseDown(e, node.node_key)}
              className={isDragged ? "cursor-grabbing" : "cursor-grab"}
            >
              {/* Larger invisible hit area */}
              <circle cx={pos.x} cy={pos.y} r={nodeRadius * 3} fill="transparent" />
              {/* Selection ring */}
              {isSelected && (
                <circle cx={pos.x} cy={pos.y} r={selectedRadius * 1.5}
                  fill="none" stroke="hsl(200 80% 50%)" strokeWidth={strokeWidth * 0.8} strokeDasharray={`${strokeWidth} ${strokeWidth * 0.5}`} opacity="0.8" />
              )}
              <circle cx={pos.x} cy={pos.y} r={isSelected || isDragged ? selectedRadius : nodeRadius}
                fill={node.is_assembly_point ? "hsl(142 76% 36%)" : "hsl(220 80% 55%)"}
                stroke="white" strokeWidth={strokeWidth * 0.6}
                opacity={isDragged ? "1" : "0.9"} />
              {layers.labels && (
                <text x={pos.x} y={Number(pos.y) - selectedRadius * 1.5} textAnchor="middle" fontSize={fontSize}
                  fill="hsl(220 80% 30%)" fontWeight="700" className="pointer-events-none select-none"
                  paintOrder="stroke" stroke="white" strokeWidth={fontSize * 0.3}>
                  {node.node_key.replace(/_/g, ' ').substring(0, 12)}
                </text>
              )}
            </g>
          );
        })}

        {/* Buildings */}
        {layers.buildings && buildings.map((b) => {
          const pos = getBuildingPos(b);
          const isDragged = dragging?.type === "building" && dragging.key === b.building_key;
          const isSelected = selectedBuildingKey === b.building_key;
          const half = buildingSize / 2;
          return (
            <g key={b.building_key}
              onMouseDown={(e) => handleBuildingMouseDown(e, b.building_key)}
              className={isDragged ? "cursor-grabbing" : "cursor-grab"}
            >
              {/* Larger invisible hit area */}
              <rect x={Number(pos.x) - half * 2} y={Number(pos.y) - half * 2} width={buildingSize * 2} height={buildingSize * 2} fill="transparent" />
              {/* Selection ring */}
              {isSelected && (
                <rect x={Number(pos.x) - half - strokeWidth * 2} y={Number(pos.y) - half - strokeWidth * 2}
                  width={buildingSize + strokeWidth * 4} height={buildingSize + strokeWidth * 4}
                  rx={strokeWidth * 2} fill="none" stroke="hsl(0 80% 55%)" strokeWidth={strokeWidth * 0.8}
                  strokeDasharray={`${strokeWidth} ${strokeWidth * 0.5}`} opacity="0.9" />
              )}
              <rect x={Number(pos.x) - half} y={Number(pos.y) - half} width={buildingSize} height={buildingSize}
                rx={strokeWidth}
                fill={isSelected ? "hsl(0 80% 55%)" : "hsl(0 70% 60%)"}
                stroke="white" strokeWidth={strokeWidth * 0.6}
                opacity={isDragged ? "1" : "0.85"} />
              <text x={pos.x} y={Number(pos.y) + buildingFontSize * 0.4} textAnchor="middle" fontSize={buildingFontSize}
                fill="white" fontWeight="bold" className="pointer-events-none select-none">
                {b.building_key.replace('b', '')}
              </text>
              {layers.labels && (
                <text x={pos.x} y={Number(pos.y) + half + buildingFontSize * 1.2} textAnchor="middle" fontSize={buildingFontSize * 0.85}
                  fill="hsl(0 60% 35%)" fontWeight="600" className="pointer-events-none select-none"
                  paintOrder="stroke" stroke="white" strokeWidth={buildingFontSize * 0.3}>
                  {b.short_name}
                </text>
              )}
            </g>
          );
        })}

        {/* Edge start indicator */}
        {edgeStart && nodeMap.has(edgeStart) && (() => {
          const pos = getNodePos(nodeMap.get(edgeStart)!);
          return (
            <circle cx={pos.x} cy={pos.y} r={selectedRadius * 2}
              fill="none" stroke="hsl(var(--destructive))" strokeWidth={strokeWidth} strokeDasharray={`${strokeWidth * 2} ${strokeWidth}`}>
              <animate attributeName="r" from={selectedRadius} to={selectedRadius * 3} dur="1s" repeatCount="indefinite" />
            </circle>
          );
        })()}
      </svg>
    </div>
  );
}

// ---- Main Page ----
export default function WayfindingAdmin() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { nodes, edges, buildings, routes } = useWayfindingData();

  const [mode, setMode] = useState<EditorMode>("select");
  const [selectedNodeKey, setSelectedNodeKey] = useState<string | null>(null);
  const [selectedBuildingKey, setSelectedBuildingKey] = useState<string | null>(null);
  const [edgeStart, setEdgeStart] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>({ nodes: true, edges: true, buildings: true, labels: true });
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [searchQuery, setSearchQuery] = useState("");

  // Dialogs
  const [nodeDialog, setNodeDialog] = useState(false);
  const [buildingDialog, setBuildingDialog] = useState(false);
  const [routeDialog, setRouteDialog] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ x: number; y: number } | null>(null);

  // Node form
  const [nodeForm, setNodeForm] = useState({ node_key: "", label: "", is_assembly_point: false });
  // Building form
  const [buildingForm, setBuildingForm] = useState({ building_key: "", name: "", short_name: "", aliases: "", description: "", category: "other", node_key: "" });
  // Route form
  const [routeForm, setRouteForm] = useState({ from_building_key: "", to_building_key: "", node_path: [] as string[], description: "" });
  const [routeNodeInput, setRouteNodeInput] = useState("");

  if (!isAdmin) return <Navigate to="/" replace />;

  const nodeList = nodes.data || [];
  const edgeList = edges.data || [];
  const buildingList = buildings.data || [];
  const routeList = routes.data || [];

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["wf-nodes"] });
    qc.invalidateQueries({ queryKey: ["wf-edges"] });
    qc.invalidateQueries({ queryKey: ["wf-buildings"] });
    qc.invalidateQueries({ queryKey: ["wf-routes"] });
  };

  // Zoom helpers
  const handleZoomIn = () => {
    setZoom(z => {
      const newZ = Math.min(z * 1.5, 5);
      // Keep center in view
      const center = { x: panOffset.x + 50 / z, y: panOffset.y + 50 / z };
      setPanOffset({ x: center.x - 50 / newZ, y: center.y - 50 / newZ });
      return newZ;
    });
  };
  const handleZoomOut = () => {
    setZoom(z => {
      const newZ = Math.max(z / 1.5, 1);
      if (newZ === 1) { setPanOffset({ x: 0, y: 0 }); return 1; }
      const center = { x: panOffset.x + 50 / z, y: panOffset.y + 50 / z };
      setPanOffset({ x: Math.max(0, center.x - 50 / newZ), y: Math.max(0, center.y - 50 / newZ) });
      return newZ;
    });
  };
  const handleResetView = () => { setZoom(1); setPanOffset({ x: 0, y: 0 }); };

  // Focus on element
  const focusOnPoint = (x: number, y: number) => {
    const newZoom = Math.max(zoom, 2.5);
    setZoom(newZoom);
    setPanOffset({
      x: Math.max(0, Math.min(x - 50 / newZoom, 100 - 100 / newZoom)),
      y: Math.max(0, Math.min(y - 50 / newZoom, 100 - 100 / newZoom)),
    });
  };

  const toggleLayer = (layer: keyof LayerVisibility) => {
    setLayers(l => ({ ...l, [layer]: !l[layer] }));
  };

  // ---- Mutations ----
  const addNode = async (x: number, y: number) => {
    const { error } = await supabase.from("wayfinding_nodes").insert({
      node_key: nodeForm.node_key, label: nodeForm.label,
      x, y, is_assembly_point: nodeForm.is_assembly_point,
    });
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "เพิ่ม Node สำเร็จ" });
    invalidateAll();
    setNodeDialog(false);
    setNodeForm({ node_key: "", label: "", is_assembly_point: false });
  };

  const deleteNode = async (key: string) => {
    const { error } = await supabase.from("wayfinding_nodes").delete().eq("node_key", key);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ลบ Node สำเร็จ" });
    invalidateAll();
    setSelectedNodeKey(null);
  };

  const updateNodePosition = async (key: string, x: number, y: number) => {
    const { error } = await supabase.from("wayfinding_nodes").update({ x, y }).eq("node_key", key);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ย้าย Node สำเร็จ" });
    invalidateAll();
  };

  const addEdge = async (fromKey: string, toKey: string) => {
    const existing = edgeList.find(e =>
      (e.from_node_key === fromKey && e.to_node_key === toKey) ||
      (e.from_node_key === toKey && e.to_node_key === fromKey)
    );
    if (existing) { toast({ title: "เส้นทางนี้มีอยู่แล้ว" }); return; }
    const { error } = await supabase.from("wayfinding_edges").insert({ from_node_key: fromKey, to_node_key: toKey });
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "เพิ่มเส้นเชื่อมสำเร็จ" });
    invalidateAll();
  };

  const deleteEdge = async (id: string) => {
    const { error } = await supabase.from("wayfinding_edges").delete().eq("id", id);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ลบเส้นเชื่อมสำเร็จ" });
    invalidateAll();
  };

  const addBuilding = async (x: number, y: number) => {
    const { error } = await supabase.from("wayfinding_buildings").insert({
      building_key: buildingForm.building_key, name: buildingForm.name,
      short_name: buildingForm.short_name, aliases: buildingForm.aliases.split(",").map(s => s.trim()).filter(Boolean),
      description: buildingForm.description, category: buildingForm.category,
      node_key: buildingForm.node_key, x, y,
    });
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "เพิ่มอาคารสำเร็จ" });
    invalidateAll();
    setBuildingDialog(false);
    setBuildingForm({ building_key: "", name: "", short_name: "", aliases: "", description: "", category: "other", node_key: "" });
  };

  const deleteBuilding = async (key: string) => {
    const { error } = await supabase.from("wayfinding_buildings").delete().eq("building_key", key);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ลบอาคารสำเร็จ" });
    invalidateAll();
    setSelectedBuildingKey(null);
  };

  const updateBuildingPosition = async (key: string, x: number, y: number) => {
    const { error } = await supabase.from("wayfinding_buildings").update({ x, y }).eq("building_key", key);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ย้ายอาคารสำเร็จ" });
    invalidateAll();
  };

  const updateBuildingNodeKey = async (buildingKey: string, newNodeKey: string) => {
    const { error } = await supabase.from("wayfinding_buildings").update({ node_key: newNodeKey }).eq("building_key", buildingKey);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "อัปเดตจุดเชื่อมสำเร็จ" });
    invalidateAll();
  };

  const addRoute = async () => {
    if (!routeForm.from_building_key || !routeForm.to_building_key || routeForm.node_path.length === 0) return;
    const { error } = await supabase.from("wayfinding_routes").insert({
      from_building_key: routeForm.from_building_key,
      to_building_key: routeForm.to_building_key,
      node_path: routeForm.node_path,
      description: routeForm.description,
    });
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "เพิ่มเส้นทางสำเร็จ" });
    invalidateAll();
    setRouteDialog(false);
    setRouteForm({ from_building_key: "", to_building_key: "", node_path: [], description: "" });
  };

  const deleteRoute = async (id: string) => {
    const { error } = await supabase.from("wayfinding_routes").delete().eq("id", id);
    if (error) { toast({ title: "ผิดพลาด", description: error.message, variant: "destructive" }); return; }
    toast({ title: "ลบเส้นทางสำเร็จ" });
    invalidateAll();
  };

  const handleMapClick = (x: number, y: number) => {
    if (mode === "add_node") {
      setPendingCoords({ x, y });
      setNodeDialog(true);
    } else if (mode === "add_building") {
      setPendingCoords({ x, y });
      setBuildingDialog(true);
    } else if (mode === "move" && selectedNodeKey) {
      updateNodePosition(selectedNodeKey, x, y);
      setSelectedNodeKey(null);
      setMode("select");
    } else if (mode === "move" && selectedBuildingKey) {
      updateBuildingPosition(selectedBuildingKey, x, y);
      setSelectedBuildingKey(null);
      setMode("select");
    }
  };

  const handleNodeClick = (key: string) => {
    if (mode === "add_edge") {
      if (!edgeStart) {
        setEdgeStart(key);
        toast({ title: "เลือก Node ต้นทาง", description: `${key} — คลิก Node ปลายทาง` });
      } else {
        if (edgeStart !== key) addEdge(edgeStart, key);
        setEdgeStart(null);
      }
    } else if (mode === "move") {
      setSelectedNodeKey(key);
      setSelectedBuildingKey(null);
      toast({ title: "คลิกบนแผนที่เพื่อย้าย Node", description: key });
    } else {
      setSelectedNodeKey(key);
      setSelectedBuildingKey(null);
    }
  };

  const handleBuildingClick = (key: string) => {
    if (mode === "move") {
      setSelectedBuildingKey(key);
      setSelectedNodeKey(null);
      toast({ title: "คลิกบนแผนที่เพื่อย้ายอาคาร", description: key });
    } else {
      setSelectedBuildingKey(key);
      setSelectedNodeKey(null);
    }
  };

  const selectedNode = nodeList.find(n => n.node_key === selectedNodeKey);
  const selectedBuilding = buildingList.find(b => b.building_key === selectedBuildingKey);

  // Filtered lists for search
  const filteredNodes = searchQuery
    ? nodeList.filter(n => n.node_key.includes(searchQuery) || n.label.includes(searchQuery))
    : nodeList;
  const filteredBuildings = searchQuery
    ? buildingList.filter(b => b.building_key.includes(searchQuery) || b.name.includes(searchQuery) || b.short_name.includes(searchQuery))
    : buildingList;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4 mr-1" /> กลับ
        </Button>
        <h2 className="text-xl font-bold">🗺️ จัดการเส้นทางนำทาง</h2>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-3 space-y-3">
          {/* Mode buttons */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={mode === "select" ? "default" : "outline"} onClick={() => { setMode("select"); setEdgeStart(null); }}>
              <MousePointer className="h-4 w-4 mr-1" /> เลือก
            </Button>
            <Button size="sm" variant={mode === "add_node" ? "default" : "outline"} onClick={() => { setMode("add_node"); setEdgeStart(null); }}>
              <Plus className="h-4 w-4 mr-1" /> เพิ่ม Node
            </Button>
            <Button size="sm" variant={mode === "add_edge" ? "default" : "outline"} onClick={() => { setMode("add_edge"); setEdgeStart(null); }}>
              <Link2 className="h-4 w-4 mr-1" /> เชื่อมถนน
            </Button>
            <Button size="sm" variant={mode === "add_building" ? "default" : "outline"} onClick={() => { setMode("add_building"); setEdgeStart(null); }}>
              <Building2 className="h-4 w-4 mr-1" /> เพิ่มอาคาร
            </Button>
            <Button size="sm" variant={mode === "move" ? "default" : "outline"} onClick={() => { setMode("move"); setEdgeStart(null); }}>
              <Move className="h-4 w-4 mr-1" /> ย้ายตำแหน่ง
            </Button>
            <Button size="sm" variant="outline" onClick={() => navigate("/wayfinding")}>
              <Eye className="h-4 w-4 mr-1" /> ดูตัวอย่าง
            </Button>
          </div>

          {/* Layer toggles + Zoom */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Button size="sm" variant={layers.nodes ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => toggleLayer("nodes")}>
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1 inline-block" /> Nodes
            </Button>
            <Button size="sm" variant={layers.edges ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => toggleLayer("edges")}>
              <span className="w-2 h-2 rounded-full bg-cyan-500 mr-1 inline-block" /> Edges
            </Button>
            <Button size="sm" variant={layers.buildings ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => toggleLayer("buildings")}>
              <span className="w-2 h-2 rounded-full bg-red-500 mr-1 inline-block" /> อาคาร
            </Button>
            <Button size="sm" variant={layers.labels ? "default" : "outline"} className="h-7 text-xs px-2" onClick={() => toggleLayer("labels")}>
              Labels
            </Button>

            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={handleZoomIn}><ZoomIn className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleResetView}>{Math.round(zoom * 100)}%</Button>
              <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={handleZoomOut}><ZoomOut className="h-4 w-4" /></Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {mode === "select" && "คลิก Node/อาคารเพื่อดูรายละเอียด • ซูมเข้าเพื่อเลือกจุดที่ซ้อนกัน"}
            {mode === "add_node" && "คลิกบนแผนที่เพื่อวาง Node ใหม่"}
            {mode === "add_edge" && (edgeStart ? `เลือก Node ปลายทาง (ต้นทาง: ${edgeStart})` : "คลิก Node แรก (ต้นทาง)")}
            {mode === "add_building" && "คลิกบนแผนที่เพื่อวางอาคารใหม่"}
            {mode === "move" && "ลาก Node/อาคาร ไปวางตำแหน่งใหม่บนแผนที่"}
          </p>
        </CardContent>
      </Card>

      {/* Map */}
      <MapEditor
        nodes={nodeList} edges={edgeList} buildings={buildingList}
        mode={mode} selectedNodeKey={selectedNodeKey} selectedBuildingKey={selectedBuildingKey} edgeStart={edgeStart}
        onMapClick={handleMapClick} onNodeClick={handleNodeClick} onBuildingClick={handleBuildingClick}
        onNodeDrag={(key, x, y) => updateNodePosition(key, x, y)}
        onBuildingDrag={(key, x, y) => updateBuildingPosition(key, x, y)}
        layers={layers} zoom={zoom} panOffset={panOffset}
      />

      {/* Quick search & list selection */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหา Node/อาคาร แล้วคลิกเพื่อซูมไปยังจุดนั้น..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-8 text-sm"
            />
            {searchQuery && (
              <Button size="sm" variant="ghost" className="h-8 px-2" onClick={() => setSearchQuery("")}>✕</Button>
            )}
          </div>
          {searchQuery && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {filteredNodes.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Nodes</p>
                  <div className="flex flex-wrap gap-1">
                    {filteredNodes.map(n => (
                      <Badge key={n.node_key} variant={selectedNodeKey === n.node_key ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:bg-primary/20"
                        onClick={() => { setSelectedNodeKey(n.node_key); setSelectedBuildingKey(null); focusOnPoint(n.x, n.y); }}>
                        🔵 {n.node_key}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {filteredBuildings.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">อาคาร</p>
                  <div className="flex flex-wrap gap-1">
                    {filteredBuildings.map(b => (
                      <Badge key={b.building_key} variant={selectedBuildingKey === b.building_key ? "default" : "outline"}
                        className="cursor-pointer text-xs hover:bg-destructive/20"
                        onClick={() => { setSelectedBuildingKey(b.building_key); setSelectedNodeKey(null); focusOnPoint(b.x, b.y); }}>
                        🔴 {b.short_name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {filteredNodes.length === 0 && filteredBuildings.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">ไม่พบผลลัพธ์</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selection info */}
      {selectedNode && mode === "select" && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">🔵 {selectedNode.node_key}</p>
                <p className="text-sm text-muted-foreground">{selectedNode.label}</p>
                <p className="text-xs text-muted-foreground">ตำแหน่ง: ({selectedNode.x}, {selectedNode.y}){selectedNode.is_assembly_point && " • จุดรวมพล ✅"}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => focusOnPoint(selectedNode.x, selectedNode.y)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteNode(selectedNode.node_key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedBuilding && mode === "select" && (
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold">🔴 {selectedBuilding.name}</p>
                <p className="text-sm text-muted-foreground">{selectedBuilding.description}</p>
                <p className="text-xs text-muted-foreground">Key: {selectedBuilding.building_key} • ตำแหน่ง: ({selectedBuilding.x}, {selectedBuilding.y})</p>
                <p className="text-xs text-muted-foreground">เชื่อมกับ Node: {selectedBuilding.node_key}</p>
              </div>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={() => focusOnPoint(selectedBuilding.x, selectedBuilding.y)}>
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="destructive" onClick={() => deleteBuilding(selectedBuilding.building_key)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">เปลี่ยนจุดเชื่อม:</Label>
              <Select value={selectedBuilding.node_key} onValueChange={(v) => updateBuildingNodeKey(selectedBuilding.building_key, v)}>
                <SelectTrigger className="h-8 text-xs w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {nodeList.map(n => <SelectItem key={n.node_key} value={n.node_key}>{n.node_key}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data tables */}
      <Tabs defaultValue="routes">
        <TabsList className="w-full">
          <TabsTrigger value="routes" className="flex-1">🗺️ เส้นทาง ({routeList.length})</TabsTrigger>
          <TabsTrigger value="nodes" className="flex-1">Nodes ({nodeList.length})</TabsTrigger>
          <TabsTrigger value="edges" className="flex-1">Edges ({edgeList.length})</TabsTrigger>
          <TabsTrigger value="buildings" className="flex-1">อาคาร ({buildingList.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="routes">
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">เส้นทางที่กำหนดเอง</p>
                <Button size="sm" onClick={() => setRouteDialog(true)}><Plus className="h-4 w-4 mr-1" /> เพิ่มเส้นทาง</Button>
              </div>
              {routeList.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีเส้นทางที่กำหนด — ระบบจะใช้ Dijkstra อัตโนมัติ</p>}
              <div className="space-y-2">
                {routeList.map(r => {
                  const fromB = buildingList.find(b => b.building_key === r.from_building_key);
                  const toB = buildingList.find(b => b.building_key === r.to_building_key);
                  return (
                    <Card key={r.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <p className="text-sm font-semibold">
                              {fromB?.short_name || r.from_building_key} → {toB?.short_name || r.to_building_key}
                            </p>
                            <p className="text-xs text-muted-foreground font-mono">
                              เส้นทาง: {r.node_path.join(" → ")}
                            </p>
                            {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                          </div>
                          <Button size="sm" variant="ghost" onClick={() => deleteRoute(r.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nodes">
          <Card><CardContent className="p-2 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Key</TableHead><TableHead>Label</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead><TableHead>จุดรวมพล</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {nodeList.map(n => (
                  <TableRow key={n.node_key} className={`${selectedNodeKey === n.node_key ? "bg-blue-50 dark:bg-blue-950" : ""} cursor-pointer`}
                    onClick={() => { setSelectedNodeKey(n.node_key); setSelectedBuildingKey(null); focusOnPoint(n.x, n.y); }}>
                    <TableCell className="text-xs font-mono">{n.node_key}</TableCell>
                    <TableCell className="text-xs">{n.label}</TableCell>
                    <TableCell className="text-xs">{n.x}</TableCell>
                    <TableCell className="text-xs">{n.y}</TableCell>
                    <TableCell className="text-xs">{n.is_assembly_point ? "✅" : ""}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteNode(n.node_key); }}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="edges">
          <Card><CardContent className="p-2 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>จาก</TableHead><TableHead>ไป</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {edgeList.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-mono">{e.from_node_key}</TableCell>
                    <TableCell className="text-xs font-mono">{e.to_node_key}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={() => deleteEdge(e.id)}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="buildings">
          <Card><CardContent className="p-2 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Key</TableHead><TableHead>ชื่อ</TableHead><TableHead>Node</TableHead><TableHead>X</TableHead><TableHead>Y</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {buildingList.map(b => (
                  <TableRow key={b.building_key} className={`${selectedBuildingKey === b.building_key ? "bg-red-50 dark:bg-red-950" : ""} cursor-pointer`}
                    onClick={() => { setSelectedBuildingKey(b.building_key); setSelectedNodeKey(null); focusOnPoint(b.x, b.y); }}>
                    <TableCell className="text-xs font-mono">{b.building_key}</TableCell>
                    <TableCell className="text-xs">{b.short_name}</TableCell>
                    <TableCell className="text-xs font-mono">{b.node_key}</TableCell>
                    <TableCell className="text-xs">{b.x}</TableCell>
                    <TableCell className="text-xs">{b.y}</TableCell>
                    <TableCell><Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteBuilding(b.building_key); }}><Trash2 className="h-3 w-3" /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Add Node Dialog */}
      <Dialog open={nodeDialog} onOpenChange={setNodeDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่ม Node ใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Key (ภาษาอังกฤษ ไม่เว้นวรรค)</Label><Input value={nodeForm.node_key} onChange={e => setNodeForm(f => ({ ...f, node_key: e.target.value }))} placeholder="junction_new" /></div>
            <div><Label>ชื่อ/Label</Label><Input value={nodeForm.label} onChange={e => setNodeForm(f => ({ ...f, label: e.target.value }))} placeholder="แยกหน้าอาคาร X" /></div>
            <div className="flex items-center gap-2">
              <Switch checked={nodeForm.is_assembly_point} onCheckedChange={v => setNodeForm(f => ({ ...f, is_assembly_point: v }))} />
              <Label>จุดรวมพล (Assembly Point)</Label>
            </div>
            <p className="text-xs text-muted-foreground">ตำแหน่ง: ({pendingCoords?.x}, {pendingCoords?.y})</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNodeDialog(false)}>ยกเลิก</Button>
            <Button onClick={() => pendingCoords && addNode(pendingCoords.x, pendingCoords.y)} disabled={!nodeForm.node_key}>เพิ่ม</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Building Dialog */}
      <Dialog open={buildingDialog} onOpenChange={setBuildingDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>เพิ่มอาคารใหม่</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Key (เช่น b23)</Label><Input value={buildingForm.building_key} onChange={e => setBuildingForm(f => ({ ...f, building_key: e.target.value }))} /></div>
            <div><Label>ชื่อเต็ม</Label><Input value={buildingForm.name} onChange={e => setBuildingForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>ชื่อย่อ</Label><Input value={buildingForm.short_name} onChange={e => setBuildingForm(f => ({ ...f, short_name: e.target.value }))} /></div>
            <div><Label>คำค้นหา (คั่นด้วย ,)</Label><Input value={buildingForm.aliases} onChange={e => setBuildingForm(f => ({ ...f, aliases: e.target.value }))} placeholder="ชื่อเรียก1,ชื่อ2" /></div>
            <div><Label>คำอธิบาย</Label><Input value={buildingForm.description} onChange={e => setBuildingForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>เชื่อมกับ Node</Label>
              <Select value={buildingForm.node_key} onValueChange={v => setBuildingForm(f => ({ ...f, node_key: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือก Node" /></SelectTrigger>
                <SelectContent>{nodeList.map(n => <SelectItem key={n.node_key} value={n.node_key}>{n.node_key} — {n.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">ตำแหน่ง: ({pendingCoords?.x}, {pendingCoords?.y})</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBuildingDialog(false)}>ยกเลิก</Button>
            <Button onClick={() => pendingCoords && addBuilding(pendingCoords.x, pendingCoords.y)} disabled={!buildingForm.building_key || !buildingForm.node_key}>เพิ่ม</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Route Dialog */}
      <Dialog open={routeDialog} onOpenChange={setRouteDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>เพิ่มเส้นทางนำทาง</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>จุดเริ่มต้น (อาคาร)</Label>
              <Select value={routeForm.from_building_key} onValueChange={v => setRouteForm(f => ({ ...f, from_building_key: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกอาคารต้นทาง" /></SelectTrigger>
                <SelectContent>{buildingList.map(b => <SelectItem key={b.building_key} value={b.building_key}>{b.short_name} ({b.building_key})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>จุดหมายปลายทาง (อาคาร)</Label>
              <Select value={routeForm.to_building_key} onValueChange={v => setRouteForm(f => ({ ...f, to_building_key: v }))}>
                <SelectTrigger><SelectValue placeholder="เลือกอาคารปลายทาง" /></SelectTrigger>
                <SelectContent>{buildingList.filter(b => b.building_key !== routeForm.from_building_key).map(b => <SelectItem key={b.building_key} value={b.building_key}>{b.short_name} ({b.building_key})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>เส้นทางผ่าน Nodes (เรียงลำดับ)</Label>
              <div className="flex gap-2 mt-1">
                <Select value={routeNodeInput} onValueChange={setRouteNodeInput}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="เลือก Node" /></SelectTrigger>
                  <SelectContent>{nodeList.map(n => <SelectItem key={n.node_key} value={n.node_key}>{n.node_key} — {n.label}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" variant="outline" onClick={() => {
                  if (routeNodeInput && !routeForm.node_path.includes(routeNodeInput)) {
                    setRouteForm(f => ({ ...f, node_path: [...f.node_path, routeNodeInput] }));
                    setRouteNodeInput("");
                  }
                }} disabled={!routeNodeInput}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {routeForm.node_path.length > 0 && (
                <div className="mt-2 space-y-1">
                  {routeForm.node_path.map((nk, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-muted rounded px-2 py-1">
                      <span className="font-mono flex-1">{i + 1}. {nk}</span>
                      <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => setRouteForm(f => ({ ...f, node_path: f.node_path.filter((_, j) => j !== i) }))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label>คำอธิบายเส้นทาง (ไม่จำเป็น)</Label>
              <Input value={routeForm.description} onChange={e => setRouteForm(f => ({ ...f, description: e.target.value }))} placeholder="เดินตรงไปแล้วเลี้ยวซ้าย..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRouteDialog(false); setRouteForm({ from_building_key: "", to_building_key: "", node_path: [], description: "" }); }}>ยกเลิก</Button>
            <Button onClick={addRoute} disabled={!routeForm.from_building_key || !routeForm.to_building_key || routeForm.node_path.length === 0}>เพิ่มเส้นทาง</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
