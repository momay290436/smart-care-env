import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WNode { id: string; node_key: string; label: string; x: number; y: number; is_assembly_point: boolean; }
export interface WEdge { id: string; from_node_key: string; to_node_key: string; weight: number | null; }
export interface WBuilding { id: string; building_key: string; name: string; short_name: string; aliases: string[]; description: string; x: number; y: number; category: string; node_key: string; }
export interface WRoute { id: string; from_building_key: string; to_building_key: string; node_path: string[]; description: string; }

export interface RouteResult {
  path: string[];
  waypoints: [number, number][];
  distance: number;
  instructions: string;
}

function euclideanDist(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x1 - x2) ** 2 + (y1 - y2) ** 2);
}

export function dijkstra(
  nodes: WNode[], edges: WEdge[], startKey: string, endKey: string
): { path: string[]; distance: number } | null {
  const nodeMap = new Map(nodes.map(n => [n.node_key, n]));
  if (!nodeMap.has(startKey) || !nodeMap.has(endKey)) return null;

  const adj = new Map<string, { neighbor: string; weight: number }[]>();
  for (const n of nodes) adj.set(n.node_key, []);

  for (const edge of edges) {
    const n1 = nodeMap.get(edge.from_node_key);
    const n2 = nodeMap.get(edge.to_node_key);
    if (!n1 || !n2) continue;
    const w = edge.weight ?? euclideanDist(Number(n1.x), Number(n1.y), Number(n2.x), Number(n2.y));
    adj.get(edge.from_node_key)!.push({ neighbor: edge.to_node_key, weight: w });
    adj.get(edge.to_node_key)!.push({ neighbor: edge.from_node_key, weight: w });
  }

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const [key] of adj) { dist.set(key, Infinity); prev.set(key, null); }
  dist.set(startKey, 0);

  while (true) {
    let u: string | null = null;
    let minD = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minD) { minD = d; u = id; }
    }
    if (u === null || u === endKey) break;
    visited.add(u);
    for (const { neighbor, weight } of adj.get(u) || []) {
      if (visited.has(neighbor)) continue;
      const alt = minD + weight;
      if (alt < (dist.get(neighbor) ?? Infinity)) { dist.set(neighbor, alt); prev.set(neighbor, u); }
    }
  }

  if (dist.get(endKey) === Infinity) return null;
  const path: string[] = [];
  let current: string | null = endKey;
  while (current) { path.unshift(current); current = prev.get(current) ?? null; }
  return { path, distance: dist.get(endKey)! };
}

export function findRouteFromGraph(
  nodes: WNode[], edges: WEdge[], buildings: WBuilding[],
  fromBuildingKey: string, toBuildingKey: string,
  predefinedRoutes?: WRoute[]
): RouteResult | null {
  const fromB = buildings.find(b => b.building_key === fromBuildingKey);
  const toB = buildings.find(b => b.building_key === toBuildingKey);
  if (!fromB || !toB) return null;

  const nodeMap = new Map(nodes.map(n => [n.node_key, n]));

  // Check for admin-defined route first
  const predefined = predefinedRoutes?.find(
    r => r.from_building_key === fromBuildingKey && r.to_building_key === toBuildingKey
  ) || predefinedRoutes?.find(
    r => r.from_building_key === toBuildingKey && r.to_building_key === fromBuildingKey
  );

  if (predefined) {
    const nodePath = predefined.from_building_key === fromBuildingKey
      ? predefined.node_path
      : [...predefined.node_path].reverse();

    const waypoints: [number, number][] = [[Number(fromB.x), Number(fromB.y)]];
    for (const nk of nodePath) {
      const n = nodeMap.get(nk);
      if (n) waypoints.push([Number(n.x), Number(n.y)]);
    }
    waypoints.push([Number(toB.x), Number(toB.y)]);

    const instructions = predefined.description
      || `จาก ${fromB.short_name} เดินผ่าน ${nodePath.map(id => nodeMap.get(id)?.label || id).join(" → ")} ไปยัง ${toB.short_name}`;

    return { path: nodePath, waypoints, distance: 0, instructions };
  }

  // Fallback to Dijkstra
  const startNode = fromB.node_key;
  const endNode = toB.node_key;

  if (startNode === endNode) {
    return {
      path: [startNode],
      waypoints: [[Number(fromB.x), Number(fromB.y)], [Number(toB.x), Number(toB.y)]],
      distance: euclideanDist(Number(fromB.x), Number(fromB.y), Number(toB.x), Number(toB.y)),
      instructions: `${fromB.short_name} และ ${toB.short_name} อยู่บริเวณเดียวกัน เดินตรงไปได้เลย`,
    };
  }

  const result = dijkstra(nodes, edges, startNode, endNode);
  if (!result) return null;

  const waypoints: [number, number][] = [[Number(fromB.x), Number(fromB.y)]];
  for (const nk of result.path) {
    const n = nodeMap.get(nk);
    if (n) waypoints.push([Number(n.x), Number(n.y)]);
  }
  waypoints.push([Number(toB.x), Number(toB.y)]);

  const junctionNames = result.path.map(id => nodeMap.get(id)?.label).filter(Boolean);
  let instructions = `จาก ${fromB.short_name} `;
  if (junctionNames.length > 0) instructions += `เดินผ่าน ${junctionNames.join(" → ")} `;
  instructions += `ไปยัง ${toB.short_name}`;

  return { path: result.path, waypoints, distance: result.distance, instructions };
}

export function useWayfindingGraph() {
  const nodes = useQuery({
    queryKey: ["wf-nodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_nodes").select("*").order("node_key");
      if (error) throw error;
      return data as WNode[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const edges = useQuery({
    queryKey: ["wf-edges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_edges").select("*");
      if (error) throw error;
      return data as WEdge[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const buildings = useQuery({
    queryKey: ["wf-buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_buildings").select("*").order("building_key");
      if (error) throw error;
      return data as WBuilding[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const routes = useQuery({
    queryKey: ["wf-routes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("wayfinding_routes").select("*");
      if (error) throw error;
      return data as WRoute[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = nodes.isLoading || edges.isLoading || buildings.isLoading || routes.isLoading;

  return {
    nodes: nodes.data || [],
    edges: edges.data || [],
    buildings: buildings.data || [],
    routes: routes.data || [],
    isLoading,
  };
}
