import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronsUpDown, MapPin, Navigation, Check, RotateCcw, Loader2 } from "lucide-react";
import { useWayfindingGraph, findRouteFromGraph, type WBuilding, type WNode, type WEdge, type RouteResult } from "@/hooks/useWayfindingGraph";

const popularIds = ["b6", "b5", "b14", "b12", "b16", "b19", "b13", "b21"];

function LocationCombobox({ value, onChange, label, excludeId, buildings }: { value: string; onChange: (v: string) => void; label: string; excludeId?: string; buildings: WBuilding[] }) {
  const [open, setOpen] = useState(false);
  const selected = buildings.find(l => l.building_key === value);
  const filtered = excludeId ? buildings.filter(l => l.building_key !== excludeId) : buildings;

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between h-12 text-base font-normal">
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <span className="truncate">{selected.name}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">{label}...</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="พิมพ์ค้นหาอาคาร..." />
            <CommandList>
              <CommandEmpty>ไม่พบสถานที่</CommandEmpty>
              <CommandGroup>
                {filtered.map((loc) => (
                  <CommandItem
                    key={loc.building_key}
                    value={[loc.name, ...(loc.aliases || [])].join(" ")}
                    onSelect={() => { onChange(loc.building_key); setOpen(false); }}
                  >
                    <Check className={`mr-2 h-4 w-4 ${value === loc.building_key ? "opacity-100" : "opacity-0"}`} />
                    <div>
                      <p className="text-sm font-medium">{loc.name}</p>
                      <p className="text-xs text-muted-foreground">{loc.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function RouteMapOverlay({ route, fromLoc, toLoc, nodes, edges }: { route: RouteResult; fromLoc: WBuilding; toLoc: WBuilding; nodes: WNode[]; edges: WEdge[] }) {
  const polylinePoints = useMemo(() => route.waypoints.map(p => `${p[0]},${p[1]}`).join(" "), [route.waypoints]);
  const arrowHead = useMemo(() => {
    const wp = route.waypoints;
    if (wp.length < 2) return null;
    const last = wp[wp.length - 1];
    const prev = wp[wp.length - 2];
    const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]) * (180 / Math.PI);
    return { x: last[0], y: last[1], angle };
  }, [route.waypoints]);

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-border shadow-md">
      <img src="/maps/buildings.jpg" alt="แผนที่โรงพยาบาลแม่สรวย" className="w-full h-auto block" draggable={false} />
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        <defs>
          <marker id="arrowRed" markerWidth="4" markerHeight="3" refX="4" refY="1.5" orient="auto">
            <polygon points="0,0 4,1.5 0,3" fill="hsl(0 80% 50%)" />
          </marker>
        </defs>
        <polyline points={polylinePoints} fill="none" stroke="hsl(0 80% 50%)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round" markerEnd="url(#arrowRed)" />
        <circle cx={fromLoc.x} cy={fromLoc.y} r="2" fill="hsl(var(--primary))" stroke="white" strokeWidth="0.5" />
        <text x={fromLoc.x} y={Number(fromLoc.y) + 0.6} textAnchor="middle" fontSize="1.8" fill="white" fontWeight="bold">A</text>
        <circle cx={toLoc.x} cy={toLoc.y} r="2" fill="hsl(0 80% 50%)" stroke="white" strokeWidth="0.5" />
        <text x={toLoc.x} y={Number(toLoc.y) + 0.6} textAnchor="middle" fontSize="1.8" fill="white" fontWeight="bold">B</text>
      </svg>
    </div>
  );
}

export default function Wayfinding() {
  const navigate = useNavigate();
  const { nodes, edges, buildings, routes, isLoading } = useWayfindingGraph();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [activeRoute, setActiveRoute] = useState<RouteResult | null>(null);
  const [searched, setSearched] = useState(false);

  const fromLoc = useMemo(() => buildings.find(l => l.building_key === fromId), [fromId, buildings]);
  const toLoc = useMemo(() => buildings.find(l => l.building_key === toId), [toId, buildings]);

  const handleSearch = () => {
    if (!fromId || !toId || fromId === toId) return;
    setActiveRoute(findRouteFromGraph(nodes, edges, buildings, fromId, toId, routes));
    setSearched(true);
  };

  const handleReset = () => { setFromId(""); setToId(""); setActiveRoute(null); setSearched(false); };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">🏥 นำทางภายในโรงพยาบาล</h2>
          <p className="text-sm text-muted-foreground">เส้นทางเดินตามถนนจริง (Dijkstra)</p>
        </div>
      </div>

      <Card className="shadow-card">
        <CardContent className="p-4 space-y-4">
          <LocationCombobox label="📍 จุดเริ่มต้น (คุณอยู่ที่ไหน?)" value={fromId} onChange={(v) => { setFromId(v); setSearched(false); }} excludeId={toId} buildings={buildings} />
          <LocationCombobox label="🏁 จุดหมายปลายทาง" value={toId} onChange={(v) => { setToId(v); setSearched(false); }} excludeId={fromId} buildings={buildings} />
          <div className="flex gap-2">
            <Button className="flex-1 h-14 text-lg font-bold" onClick={handleSearch} disabled={!fromId || !toId || fromId === toId}>
              <Navigation className="mr-2 h-5 w-5" /> ค้นหาเส้นทาง
            </Button>
            {searched && <Button variant="outline" className="h-14" onClick={handleReset}><RotateCcw className="h-5 w-5" /></Button>}
          </div>
        </CardContent>
      </Card>

      {searched && activeRoute && fromLoc && toLoc && (
        <div className="space-y-4 animate-fade-in">
          <RouteMapOverlay route={activeRoute} fromLoc={fromLoc} toLoc={toLoc} nodes={nodes} edges={edges} />
          <Card className="shadow-card border-l-4 border-l-primary">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">A</span>
                <span className="font-semibold">{fromLoc.name}</span>
              </div>
              <div className="ml-3 border-l-2 border-dashed border-primary/30 pl-4 py-2">
                <p className="text-sm text-foreground leading-relaxed">{activeRoute.instructions}</p>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">B</span>
                <span className="font-semibold">{toLoc.name}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {searched && !activeRoute && (
        <Card className="shadow-card"><CardContent className="p-6 text-center"><p className="text-muted-foreground">ไม่พบเส้นทางระหว่างจุดที่เลือก</p></CardContent></Card>
      )}

      {!searched && (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">สถานที่ยอดนิยม</p>
          <div className="grid grid-cols-2 gap-2">
            {buildings.filter(l => popularIds.includes(l.building_key)).map((loc) => (
              <Button key={loc.building_key} variant="outline" className="h-auto py-3 px-3 justify-start text-left"
                onClick={() => { setToId(loc.building_key); if (!fromId) setFromId("entrance"); }}>
                <MapPin className="h-4 w-4 text-primary shrink-0 mr-2" />
                <div>
                  <p className="text-xs font-semibold leading-tight">{loc.short_name}</p>
                  <p className="text-[10px] text-muted-foreground">{loc.description}</p>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
