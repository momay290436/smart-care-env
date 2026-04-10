// ==============================
// Graph-based Wayfinding System
// Dijkstra's Algorithm for shortest path
// Coordinates calibrated to public/maps/buildings.jpg
// ==============================

export interface LocationPoint {
  id: string;
  name: string;
  shortName: string;
  aliases: string[];
  description: string;
  x: number; // percentage on map image (0-100)
  y: number;
  category: "clinical" | "support" | "admin" | "service" | "other";
  nodeId: string; // which graph node this building connects to
}

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  label?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  weight?: number;
}

export interface RouteResult {
  path: string[];
  waypoints: [number, number][];
  distance: number;
  instructions: string;
}

// ---- GRAPH NODES (road junctions) ----
export const graphNodes: GraphNode[] = [
  { id: "main_ent", x: 15, y: 90, label: "ทางเข้าหลัก (ข้างอาคาร 22)" },
  { id: "roundabout", x: 30, y: 90, label: "วงเวียน" },
  { id: "junction_west", x: 32, y: 65, label: "แยกหน้าอาคาร 5" },
  { id: "junction_center", x: 55, y: 65, label: "แยกกลาง (หน้าอาคาร 7)" },
  { id: "junction_east", x: 82, y: 65, label: "แยกขวา (หน้าอาคาร 16)" },
  { id: "junction_north_west", x: 32, y: 25, label: "แยกบนซ้าย (ไปอาคาร 1-4)" },
  { id: "junction_north_center", x: 55, y: 25, label: "แยกบนกลาง (ไปอาคาร 9-12)" },
  { id: "junction_north_east", x: 82, y: 25, label: "แยกบนขวา (ไปอาคาร 19)" },
];

// ---- GRAPH EDGES (road connections) ----
export const graphEdges: GraphEdge[] = [
  // South road
  { from: "main_ent", to: "roundabout" },
  // Roundabout to junction west
  { from: "roundabout", to: "junction_west" },
  // West to center
  { from: "junction_west", to: "junction_center" },
  // Center to east
  { from: "junction_center", to: "junction_east" },
  // West vertical (north)
  { from: "junction_west", to: "junction_north_west" },
  // Center vertical (north)
  { from: "junction_center", to: "junction_north_center" },
  // East vertical (north)
  { from: "junction_east", to: "junction_north_east" },
  // North horizontal connections
  { from: "junction_north_west", to: "junction_north_center" },
  { from: "junction_north_center", to: "junction_north_east" },
];

// ---- LOCATIONS (Buildings 1-22 + Entrance) ----
export const locations: LocationPoint[] = [
  { id: "entrance", name: "ทางเข้าประตู 1 (วงเวียน)", shortName: "ทางเข้า", aliases: ["ประตู", "ทางเข้า", "วงเวียน", "หน้าโรงพยาบาล", "gate"], description: "ทางเข้าหลักหน้าโรงพยาบาล", x: 15, y: 90, category: "other", nodeId: "main_ent" },
  { id: "b1", name: "1. อาคารยานพาหนะ", shortName: "ยานพาหนะ", aliases: ["ยานพาหนะ", "รถ", "จอดรถ"], description: "อาคารยานพาหนะ", x: 25, y: 20, category: "support", nodeId: "junction_north_west" },
  { id: "b2", name: "2. อาคารซักฟอกจ่ายกลาง", shortName: "ซักฟอก", aliases: ["ซักฟอก", "จ่ายกลาง"], description: "งานซักฟอกและจ่ายกลาง", x: 28, y: 22, category: "support", nodeId: "junction_north_west" },
  { id: "b3", name: "3. อาคารโภชนาการ", shortName: "โภชนาการ", aliases: ["โภชนาการ", "ครัว", "อาหาร"], description: "งานโภชนาการ", x: 36, y: 22, category: "support", nodeId: "junction_north_west" },
  { id: "b4", name: "4. อาคารนิธิธัญญารักษ์", shortName: "นิธิธัญญารักษ์", aliases: ["นิธิธัญญารักษ์"], description: "อาคารนิธิธัญญารักษ์", x: 38, y: 28, category: "clinical", nodeId: "junction_north_west" },
  { id: "b5", name: "5. อาคารชันสูตร", shortName: "ชันสูตร", aliases: ["ชันสูตร", "แล็ป", "lab", "ตรวจเลือด"], description: "ห้องปฏิบัติการชันสูตร (Lab)", x: 28, y: 62, category: "clinical", nodeId: "junction_west" },
  { id: "b6", name: "6. อาคารผู้ป่วยนอก-ใน (OPD)", shortName: "OPD/IPD", aliases: ["opd", "ผู้ป่วยนอก", "ผู้ป่วยใน", "ตรวจโรค", "ipd"], description: "อาคารผู้ป่วยนอก-ใน", x: 35, y: 85, category: "clinical", nodeId: "roundabout" },
  { id: "b7", name: "7. อาคารผู้ป่วยใน-ชาย", shortName: "ผู้ป่วยใน(ช)", aliases: ["ผู้ป่วยในชาย", "วอร์ดชาย"], description: "หอผู้ป่วยในชาย", x: 50, y: 60, category: "clinical", nodeId: "junction_center" },
  { id: "b8", name: "8. อาคารซ่อมบำรุง", shortName: "ซ่อมบำรุง", aliases: ["ซ่อมบำรุง", "ช่าง"], description: "งานซ่อมบำรุง", x: 38, y: 45, category: "support", nodeId: "junction_west" },
  { id: "b9", name: "9. อาคารคลังยา", shortName: "คลังยา", aliases: ["คลังยา", "ห้องยา", "เภสัช"], description: "คลังยาและเวชภัณฑ์", x: 48, y: 22, category: "clinical", nodeId: "junction_north_center" },
  { id: "b10", name: "10. อาคารสิ่งแวดล้อม", shortName: "สิ่งแวดล้อม", aliases: ["สิ่งแวดล้อม"], description: "งานสิ่งแวดล้อม", x: 52, y: 20, category: "support", nodeId: "junction_north_center" },
  { id: "b11", name: "11. อาคารพัสดุ", shortName: "พัสดุ", aliases: ["พัสดุ"], description: "งานพัสดุ", x: 58, y: 22, category: "admin", nodeId: "junction_north_center" },
  { id: "b12", name: "12. อาคารทันตกรรม", shortName: "ทันตกรรม", aliases: ["ทันตกรรม", "ฟัน", "หมอฟัน"], description: "คลินิกทันตกรรม", x: 62, y: 28, category: "clinical", nodeId: "junction_north_center" },
  { id: "b13", name: "13. อาคารผู้ป่วยใน-หญิง", shortName: "ผู้ป่วยใน(ญ)", aliases: ["ผู้ป่วยในหญิง", "วอร์ดหญิง"], description: "หอผู้ป่วยในหญิง", x: 58, y: 60, category: "clinical", nodeId: "junction_center" },
  { id: "b14", name: "14. อาคารเอกซเรย์ (X-ray)", shortName: "X-Ray", aliases: ["xray", "เอกซเรย์", "x-ray"], description: "ห้องเอกซเรย์", x: 50, y: 55, category: "clinical", nodeId: "junction_center" },
  { id: "b15", name: "15. อาคารอำนวยการ", shortName: "อำนวยการ", aliases: ["อำนวยการ", "สำนักงาน"], description: "อาคารอำนวยการ", x: 60, y: 58, category: "admin", nodeId: "junction_center" },
  { id: "b16", name: "16. อาคารปฐมภูมิ,กายภาพบำบัด", shortName: "กายภาพ", aliases: ["ปฐมภูมิ", "กายภาพบำบัด", "กายภาพ"], description: "งานปฐมภูมิและกายภาพบำบัด", x: 78, y: 60, category: "clinical", nodeId: "junction_east" },
  { id: "b17", name: "17. อาคารงานประกันสุขภาพ", shortName: "ประกันสุขภาพ", aliases: ["ประกันสุขภาพ", "ประกัน"], description: "งานประกันสุขภาพ", x: 85, y: 55, category: "admin", nodeId: "junction_east" },
  { id: "b18", name: "18. อาคารจิตเวชและยาเสพติด", shortName: "จิตเวช", aliases: ["จิตเวช", "ยาเสพติด"], description: "คลินิกจิตเวชและยาเสพติด", x: 85, y: 40, category: "clinical", nodeId: "junction_north_east" },
  { id: "b19", name: "19. อาคารแพทย์แผนไทย", shortName: "แพทย์แผนไทย", aliases: ["แพทย์แผนไทย", "นวด", "สมุนไพร"], description: "คลินิกแพทย์แผนไทย", x: 78, y: 22, category: "clinical", nodeId: "junction_north_east" },
  { id: "b20", name: "20. อาคารศรีศิริกฤษณจันทร์", shortName: "ศรีศิริฯ", aliases: ["ศรีศิริกฤษณจันทร์", "ศรีศิริ"], description: "อาคารศรีศิริกฤษณจันทร์", x: 88, y: 30, category: "other", nodeId: "junction_north_east" },
  { id: "b21", name: "21. ร้านจำหน่ายอาหาร", shortName: "ร้านอาหาร", aliases: ["ร้านอาหาร", "โรงอาหาร", "กินข้าว"], description: "ร้านจำหน่ายอาหาร", x: 35, y: 92, category: "service", nodeId: "roundabout" },
  { id: "b22", name: "22. สำนักงานสาธารณสุขอำเภอ", shortName: "สสอ.", aliases: ["สสอ", "สาธารณสุขอำเภอ"], description: "สำนักงานสาธารณสุขอำเภอ", x: 10, y: 85, category: "admin", nodeId: "main_ent" },
];

// ---- DIJKSTRA'S ALGORITHM ----
function euclideanDist(n1: GraphNode, n2: GraphNode): number {
  return Math.sqrt((n1.x - n2.x) ** 2 + (n1.y - n2.y) ** 2);
}

function buildAdjacency(): Map<string, { neighbor: string; weight: number }[]> {
  const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
  const adj = new Map<string, { neighbor: string; weight: number }[]>();

  for (const node of graphNodes) {
    adj.set(node.id, []);
  }

  for (const edge of graphEdges) {
    const n1 = nodeMap.get(edge.from);
    const n2 = nodeMap.get(edge.to);
    if (!n1 || !n2) continue;
    const w = edge.weight ?? euclideanDist(n1, n2);
    adj.get(edge.from)!.push({ neighbor: edge.to, weight: w });
    adj.get(edge.to)!.push({ neighbor: edge.from, weight: w });
  }

  return adj;
}

let _adj: ReturnType<typeof buildAdjacency> | null = null;
function getAdj() {
  if (!_adj) _adj = buildAdjacency();
  return _adj;
}

export function dijkstra(startId: string, endId: string): { path: string[]; distance: number } | null {
  const adj = getAdj();
  if (!adj.has(startId) || !adj.has(endId)) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const visited = new Set<string>();

  for (const [id] of adj) {
    dist.set(id, Infinity);
    prev.set(id, null);
  }
  dist.set(startId, 0);

  while (true) {
    let u: string | null = null;
    let minD = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minD) {
        minD = d;
        u = id;
      }
    }
    if (u === null || u === endId) break;
    visited.add(u);

    for (const { neighbor, weight } of adj.get(u) || []) {
      if (visited.has(neighbor)) continue;
      const alt = minD + weight;
      if (alt < (dist.get(neighbor) ?? Infinity)) {
        dist.set(neighbor, alt);
        prev.set(neighbor, u);
      }
    }
  }

  if (dist.get(endId) === Infinity) return null;

  const path: string[] = [];
  let current: string | null = endId;
  while (current) {
    path.unshift(current);
    current = prev.get(current) ?? null;
  }

  return { path, distance: dist.get(endId)! };
}

// ---- PUBLIC API ----
export function findRoute(fromLocId: string, toLocId: string): RouteResult | null {
  const fromLoc = locations.find(l => l.id === fromLocId);
  const toLoc = locations.find(l => l.id === toLocId);
  if (!fromLoc || !toLoc) return null;

  const startNode = fromLoc.nodeId;
  const endNode = toLoc.nodeId;

  // Same node — direct walk
  if (startNode === endNode) {
    return {
      path: [startNode],
      waypoints: [[fromLoc.x, fromLoc.y], [toLoc.x, toLoc.y]],
      distance: euclideanDist({ id: "", x: fromLoc.x, y: fromLoc.y }, { id: "", x: toLoc.x, y: toLoc.y }),
      instructions: generateInstructions([], fromLoc, toLoc, true),
    };
  }

  const result = dijkstra(startNode, endNode);
  if (!result) return null;

  const nodeMap = new Map(graphNodes.map(n => [n.id, n]));

  // Build waypoints: from building → through road nodes → to building
  const waypoints: [number, number][] = [];
  waypoints.push([fromLoc.x, fromLoc.y]);
  for (const nodeId of result.path) {
    const n = nodeMap.get(nodeId)!;
    waypoints.push([n.x, n.y]);
  }
  waypoints.push([toLoc.x, toLoc.y]);

  return {
    path: result.path,
    waypoints,
    distance: result.distance,
    instructions: generateInstructions(result.path, fromLoc, toLoc, false),
  };
}

function generateInstructions(path: string[], from: LocationPoint, to: LocationPoint, sameNode: boolean): string {
  if (sameNode) {
    return `${from.shortName} และ ${to.shortName} อยู่บริเวณเดียวกัน เดินตรงไปได้เลย (ประมาณ 1 นาที)`;
  }

  const nodeMap = new Map(graphNodes.map(n => [n.id, n]));
  const junctionNames = path
    .map(id => nodeMap.get(id)?.label)
    .filter(Boolean);

  let text = `จาก ${from.shortName} `;
  if (junctionNames.length > 0) {
    text += `เดินผ่าน ${junctionNames.join(" → ")} `;
  }
  text += `ไปยัง ${to.shortName}`;

  const minutes = Math.max(1, Math.round(path.length * 2));
  text += ` (ประมาณ ${minutes} นาที)`;

  return text;
}

// Assembly points for emergency evacuation (main_ent and roundabout)
export const assemblyPoints = [
  { id: "ap1", name: "จุดรวมพล 1 (ทางเข้าหลัก)", x: 15, y: 90, nearestNodeId: "main_ent" },
  { id: "ap2", name: "จุดรวมพล 2 (วงเวียน)", x: 30, y: 90, nearestNodeId: "roundabout" },
];
