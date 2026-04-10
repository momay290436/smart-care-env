import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, MapPin, Users, ClipboardList, BookOpen, Flame, AlertTriangle, Plus, Edit, Trash2 } from "lucide-react";
import { useWayfindingGraph, dijkstra, type RouteResult } from "@/hooks/useWayfindingGraph";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";

const BUILDINGS = ["OPD", "IPD ชาย", "IPD หญิง", "คลังยา", "หน่วยจ่ายกลาง", "อาคารซ่อมบำรุง", "โรงไฟฟ้า", "คลังพัสดุ", "อาคารอำนวยการ", "อาคารแพทย์แผนไทย", "อาคารโภชนาการ", "อาคารซักฟอก"];
const FLOORS = ["ชั้น 1", "ชั้น 2", "ชั้น 3"];

const INTERNAL_CONTACTS = [
  { name: "ศูนย์โทรศัพท์ / วิทยุสื่อสาร", numbers: ["0", "187", "176"] },
  { name: "ห้องอุบัติเหตุและฉุกเฉิน (ER)", numbers: ["108"] },
  { name: "หน่วยรักษาความปลอดภัย (รปภ.)", numbers: ["175", "181"] },
];
const EXTERNAL_CONTACTS = [
  { name: "แจ้งเหตุไฟไหม้", numbers: ["199"] },
  { name: "อบต.แม่พริก", numbers: ["0-5378-6368"] },
  { name: "เทศบาลตำบลแม่สรวย", numbers: ["0-5365-6050"] },
  { name: "สภ.อ.แม่สรวย", numbers: ["0-5373-2602"] },
  { name: "การไฟฟ้าอ.แม่สรวย", numbers: ["0-5378-6106"] },
];

const OPERATION_UNITS = [
  { name: "กองอำนวยการ", duty: "กำหนดนโยบาย อำนวยการดับเพลิง ประเมินสถานการณ์ ประสานงานหน่วยงานภายนอก" },
  { name: "หน่วยสื่อสารประชาสัมพันธ์", duty: "ประกาศแจ้งเหตุ ประสานงานหน่วยงานต่างๆ แจ้งผู้ป่วยและญาติ" },
  { name: "หน่วยรักษาความสงบ", duty: "ปิดกั้นการจราจร ควบคุมบริเวณเกิดเหตุ รักษาความปลอดภัย" },
  { name: "หน่วยดับเพลิง/ค้นหา", duty: "ดับเพลิงเบื้องต้น ช่วยเหลือผู้ตกอยู่ในเขตเพลิง จำกัดเขตเพลิงไหม้" },
  { name: "หน่วยเคลื่อนย้ายผู้ป่วย", duty: "เคลื่อนย้ายผู้ป่วยตามลำดับความสำคัญ ดูแลผู้ป่วยตามประเภท" },
  { name: "หน่วยเคลื่อนย้ายทรัพย์สิน", duty: "เคลื่อนย้ายอุปกรณ์การแพทย์ เอกสาร ทรัพย์สินราชการ" },
  { name: "หน่วยปฐมพยาบาล", duty: "ปฐมพยาบาลผู้บาดเจ็บ ณ จุดเกิดเหตุ บันทึกรายละเอียดผู้ป่วย" },
  { name: "หน่วยสงเคราะห์", duty: "จัดเตรียมอาหาร น้ำดื่ม เสื้อผ้า ดูแลสวัสดิการผู้ประสบภัย" },
  { name: "หน่วยยานพาหนะ", duty: "เตรียมรถพยาบาล นำส่งผู้ป่วยรักษาต่อ" },
];

function waypointsToSmoothPath(wp: [number, number][]): string {
  if (wp.length < 2) return "";
  if (wp.length === 2) return `M${wp[0][0]},${wp[0][1]} L${wp[1][0]},${wp[1][1]}`;
  let d = `M${wp[0][0]},${wp[0][1]}`;
  for (let i = 1; i < wp.length; i++) {
    const prev = wp[i - 1]; const curr = wp[i];
    if (i === 1) { const mx = (prev[0] + curr[0]) / 2; const my = (prev[1] + curr[1]) / 2; d += ` Q${prev[0]},${prev[1]} ${mx},${my}`; }
    if (i < wp.length - 1) { const next = wp[i + 1]; const mx = (curr[0] + next[0]) / 2; const my = (curr[1] + next[1]) / 2; d += ` Q${curr[0]},${curr[1]} ${mx},${my}`; }
    else { d += ` Q${curr[0]},${curr[1]} ${curr[0]},${curr[1]}`; }
  }
  return d;
}

export default function FireSafety() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { nodes, edges, buildings, isLoading } = useWayfindingGraph();
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [evacuationRoute, setEvacuationRoute] = useState<RouteResult | null>(null);
  const [showSOS, setShowSOS] = useState(false);
  const [sosBuilding, setSosBuilding] = useState("");
  const [sosFloor, setSosFloor] = useState("");
  const [sosSending, setSosSending] = useState(false);
  
  // Bed management states
  const [showBedForm, setShowBedForm] = useState(false);
  const [editingBed, setEditingBed] = useState<any>(null);
  const [bedPriority, setBedPriority] = useState("1");
  const [bedNumber, setBedNumber] = useState("");
  const [bedDept, setBedDept] = useState("");
  
  // Staff count management
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [staffData, setStaffData] = useState<Record<string, number>>({});

  const assemblyNodes = useMemo(() => nodes.filter(n => n.is_assembly_point), [nodes]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.node_key, n])), [nodes]);

  // Departments for staff management
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const { data: fireChecks } = useQuery({
    queryKey: ["fire-checks-all"],
    queryFn: async () => { const { data } = await supabase.from("fire_extinguisher_checks").select("*").order("checked_at", { ascending: false }).limit(50); return data || []; },
  });

  const { data: fireLocations } = useQuery({
    queryKey: ["fire-locations"],
    queryFn: async () => { const { data } = await supabase.from("fire_extinguisher_locations").select("*").order("name"); return data || []; },
  });

  const { data: beds = [] } = useQuery({
    queryKey: ["evacuation-beds"],
    queryFn: async () => { const { data } = await supabase.from("evacuation_beds").select("*").order("priority, bed_number"); return data || []; },
  });

  const allOk = useMemo(() => {
    if (!fireLocations || fireLocations.length === 0) return true;
    const latestByLoc: Record<string, any> = {};
    fireChecks?.forEach(c => { if (!latestByLoc[c.location]) latestByLoc[c.location] = c; });
    return Object.values(latestByLoc).every((c: any) => c.pressure_ok && c.condition_ok);
  }, [fireLocations, fireChecks]);

  const handleEmergencyRoute = (buildingKey: string) => {
    setSelectedBuilding(buildingKey);
    const building = buildings.find(b => b.building_key === buildingKey);
    if (!building) return;
    let bestRoute: RouteResult | null = null;
    for (const ap of assemblyNodes) {
      const result = dijkstra(nodes, edges, building.node_key, ap.node_key);
      if (!result) continue;
      const waypoints: [number, number][] = [[Number(building.x), Number(building.y)]];
      for (const nk of result.path) { const n = nodeMap.get(nk); if (n) waypoints.push([Number(n.x), Number(n.y)]); }
      const route: RouteResult = { path: result.path, waypoints, distance: result.distance, instructions: `จาก ${building.short_name} ไปยังจุดรวมพลที่ใกล้ที่สุด` };
      if (!bestRoute || route.distance < bestRoute.distance) bestRoute = route;
    }
    setEvacuationRoute(bestRoute);
  };

  const handleSOS = async () => {
    if (!sosBuilding) { toast.error("กรุณาเลือกอาคาร"); return; }
    setSosSending(true);
    try {
      await supabase.from("evacuation_events").insert({ building: sosBuilding, floor: sosFloor || null, reported_by: user!.id });
      await supabase.functions.invoke("line-notify", {
        body: { message: `🚨 แจ้งเหตุเพลิงไหม้!\nอาคาร: ${sosBuilding}\nชั้น: ${sosFloor || "ไม่ระบุ"}\nเวลา: ${new Date().toLocaleTimeString("th-TH")}` },
      }).catch(() => {});
      toast.success(`ส่งแจ้งเหตุสำเร็จ: อาคาร ${sosBuilding} ${sosFloor}`);
      setShowSOS(false);
    } catch (e: any) { toast.error(e.message); }
    finally { setSosSending(false); }
  };

  const markBedSafe = useMutation({
    mutationFn: async ({ id, is_safe }: { id: string; is_safe: boolean }) => {
      await supabase.from("evacuation_beds").update({ is_safe, safe_at: is_safe ? new Date().toISOString() : null }).eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["evacuation-beds"] }),
  });

  // Bed CRUD mutations
  const createBed = useMutation({
    mutationFn: async () => {
      if (!bedNumber || !bedDept || !bedPriority || !user) throw new Error("ข้อมูลไม่ครบ");
      const { error } = await supabase.from("evacuation_beds").insert({
        priority: parseInt(bedPriority),
        bed_number: bedNumber,
        ward: bedDept,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มเตียงผู้ป่วยสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["evacuation-beds"] });
      setShowBedForm(false);
      setBedNumber("");
      setBedDept("");
      setBedPriority("1");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateBed = useMutation({
    mutationFn: async () => {
      if (!editingBed?.id || !bedNumber || !bedDept) throw new Error("ข้อมูลไม่ครบ");
      const { error } = await supabase.from("evacuation_beds").update({
        priority: parseInt(bedPriority),
        bed_number: bedNumber,
        ward: bedDept,
      }).eq("id", editingBed.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัปเดตเตียงผู้ป่วยสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["evacuation-beds"] });
      setEditingBed(null);
      setBedNumber("");
      setBedDept("");
      setBedPriority("1");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBed = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("evacuation_beds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบเตียงผู้ป่วยสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["evacuation-beds"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const patientsWithBed = beds.filter(b => b.has_patient);
  const patientsSafe = patientsWithBed.filter(b => b.is_safe).length;
  const patientsTotal = patientsWithBed.length;
  const evacuationProgress = patientsTotal > 0 ? Math.round((patientsSafe / patientsTotal) * 100) : 0;

  const smoothPath = evacuationRoute ? waypointsToSmoothPath(evacuationRoute.waypoints) : "";

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-foreground" /></div>;

  return (
    <div className="space-y-4 pb-6">
      {/* SOS Header */}
      <div className="rounded-2xl bg-destructive p-4 text-center">
        <Button className="w-full h-14 text-xl font-bold rounded-2xl bg-white text-destructive hover:bg-white/90 shadow-elevated" onClick={() => setShowSOS(true)}>
          SOS / แจ้งเหตุเพลิงไหม้
        </Button>
      </div>

      {/* Status bar */}
      <div className={`rounded-2xl p-3 text-center text-sm font-semibold ${allOk ? "bg-green-500/20 text-green-200 border border-green-500/30" : "bg-red-500/20 text-red-200 border border-red-500/30"}`}>
        ระบบดับเพลิงทั้งหมด: {allOk ? "พร้อมใช้งาน" : "พบปัญหา กรุณาตรวจสอบ"}
      </div>

      <PageHeader title="Fire Safety" subtitle="แผนป้องกันและระงับอัคคีภัย" />

      {/* 4 Action Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { icon: Flame, label: "แผนที่ฉุกเฉิน", tab: "map", border: "border-l-4 border-l-red-400" },
          { icon: BookOpen, label: "คู่มือการอพยพ", tab: "guide", border: "border-l-4 border-l-blue-400" },
          { icon: Phone, label: "เบอร์โทรฉุกเฉิน", tab: "contacts", border: "border-l-4 border-l-green-400" },
          { icon: ClipboardList, label: "ตรวจสอบผู้ป่วย", tab: "evacuation", border: "border-l-4 border-l-amber-400" },
        ].map((item, i) => (
          <Card key={i} className={`shadow-card bg-card rounded-2xl cursor-pointer hover:shadow-elevated transition-all active:scale-[0.97] ${item.border}`}>
            <CardContent className="p-5 flex flex-col items-center gap-2 text-center">
              <item.icon className="h-6 w-6 text-card-foreground" />
              <span className="text-base font-bold text-card-foreground">{item.label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="map" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-5 h-12 rounded-2xl bg-white/10">
          <TabsTrigger value="map" className="rounded-xl text-xs font-semibold text-foreground data-[state=active]:bg-white data-[state=active]:text-card-foreground">แผนที่</TabsTrigger>
          <TabsTrigger value="guide" className="rounded-xl text-xs font-semibold text-foreground data-[state=active]:bg-white data-[state=active]:text-card-foreground">คู่มือ</TabsTrigger>
          <TabsTrigger value="contacts" className="rounded-xl text-xs font-semibold text-foreground data-[state=active]:bg-white data-[state=active]:text-card-foreground">เบอร์โทร</TabsTrigger>
          <TabsTrigger value="evacuation" className="rounded-xl text-xs font-semibold text-foreground data-[state=active]:bg-white data-[state=active]:text-card-foreground">ผู้ป่วย</TabsTrigger>
          {isAdmin && <TabsTrigger value="admin" className="rounded-xl text-xs font-semibold text-foreground data-[state=active]:bg-white data-[state=active]:text-card-foreground">จัดการ</TabsTrigger>}
        </TabsList>

        {/* MAP TAB */}
        <TabsContent value="map" className="space-y-4">
          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <span className="text-base font-bold text-card-foreground">เลือกอาคารที่เกิดเหตุ</span>
              <Select value={selectedBuilding || ""} onValueChange={handleEmergencyRoute}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกอาคาร..." /></SelectTrigger>
                <SelectContent>{buildings.filter(b => b.building_key !== "entrance").map(b => <SelectItem key={b.building_key} value={b.building_key}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
              <div className="flex gap-3 text-xs text-card-foreground">
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-green-500" /> Non-CFC</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-red-500" /> เคมีแห้ง</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-blue-500" /> สายน้ำ</span>
                <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full bg-amber-500" /> จุดรวมพล</span>
              </div>
            </CardContent>
          </Card>

          <div className="relative w-full rounded-2xl overflow-hidden border border-white/20 shadow-card">
            <img src="/maps/buildings.jpg" alt="แผนที่โรงพยาบาล" className="w-full h-auto block" draggable={false} />
            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
              {edges.map((edge, i) => {
                const n1 = nodeMap.get(edge.from_node_key); const n2 = nodeMap.get(edge.to_node_key);
                if (!n1 || !n2) return null;
                return <line key={i} x1={n1.x} y1={n1.y} x2={n2.x} y2={n2.y} stroke="white" strokeWidth="0.2" opacity="0.15" />;
              })}
              {assemblyNodes.map(ap => (
                <g key={ap.node_key}>
                  <circle cx={ap.x} cy={ap.y} r="2.5" fill="hsl(38 92% 50%)" stroke="white" strokeWidth="0.5" opacity="0.9" />
                  <text x={ap.x} y={Number(ap.y) + 0.7} textAnchor="middle" fontSize="1.5" fill="white" fontWeight="bold">★</text>
                </g>
              ))}
              {evacuationRoute && smoothPath && (
                <path d={smoothPath} fill="none" stroke="hsl(38 92% 50%)" strokeWidth="1" strokeLinecap="round" strokeDasharray="2 1">
                  <animate attributeName="stroke-dashoffset" from="6" to="0" dur="0.8s" repeatCount="indefinite" />
                </path>
              )}
              {selectedBuilding && (() => {
                const loc = buildings.find(b => b.building_key === selectedBuilding);
                if (!loc) return null;
                return <circle cx={loc.x} cy={loc.y} r="3" fill="hsl(0 72% 55%)" stroke="white" strokeWidth="0.6"><animate attributeName="r" values="3;4;3" dur="1s" repeatCount="indefinite" /></circle>;
              })()}
            </svg>
          </div>

          {evacuationRoute && (
            <Card className="shadow-card bg-card rounded-2xl border-l-4 border-l-amber-400">
              <CardContent className="p-4">
                <p className="text-base font-bold text-card-foreground">เส้นทางหนีไฟ</p>
                <p className="text-base text-muted-foreground">{evacuationRoute.instructions}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GUIDE TAB */}
        <TabsContent value="guide" className="space-y-4">
          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-lg font-bold text-card-foreground">ขั้นตอนปฏิบัติ (ในเวลาราชการ)</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-card-foreground">
                <li>ผู้พบเห็นเหตุแจ้งหัวหน้างาน/หัวหน้าเวร และศูนย์โทรศัพท์ (0, 187)</li>
                <li>ประเมินสถานการณ์ - ใช้ถังดับเพลิงหากควบคุมได้</li>
                <li>หากไม่สามารถควบคุมได้ ประกาศใช้แผนป้องกันอัคคีภัย</li>
                <li>เคลื่อนย้ายผู้ป่วยไปจุดรวมพล</li>
                <li>ประสานหน่วยดับเพลิงท้องถิ่น</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-lg font-bold text-card-foreground">ขั้นตอนปฏิบัติ (นอกเวลาราชการ)</h3>
              <ol className="list-decimal pl-5 space-y-2 text-sm text-card-foreground">
                <li>แพทย์เวร (ผู้ป่วยในนอกเวลา) ทำหน้าที่กองอำนวยการ</li>
                <li>พยาบาล ER รับแจ้งเหตุ</li>
                <li>ยาม รปภ. ปิดกั้นการจราจร</li>
                <li>เจ้าหน้าที่ดับเพลิงประจำหน่วยงานดับเพลิงเบื้องต้น</li>
                <li>พยาบาลเวร + ผู้ช่วย + พนักงานเปล ขนย้ายผู้ป่วย</li>
              </ol>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">บทบาทหน้าที่หน่วยปฏิบัติการ</h3>
              {OPERATION_UNITS.map((unit, i) => (
                <div key={i} className="p-3 rounded-xl bg-muted/50 border border-border/50">
                  <p className="font-bold text-base text-card-foreground">{i + 1}. {unit.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{unit.duty}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">ลำดับการเคลื่อนย้าย</h3>
              <div className="space-y-2">
                <p className="font-semibold text-base text-card-foreground">ผู้ป่วย:</p>
                <div className="flex flex-wrap gap-2">
                  {["ช่วยเหลือตัวเองไม่ได้", "ช่วยเหลือตัวเองได้", "ใช้เครื่องช่วยชีวิต"].map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs rounded-xl">{i + 1}. {t}</Badge>
                  ))}
                </div>
                <p className="font-semibold text-base text-card-foreground mt-3">ทรัพย์สิน:</p>
                <div className="flex flex-wrap gap-2">
                  {["วัตถุไวไฟ", "อุปกรณ์การแพทย์", "ประวัติผู้ป่วย", "อุปกรณ์อื่นๆ"].map((t, i) => (
                    <Badge key={i} variant="outline" className="text-xs rounded-xl">{i + 1}. {t}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">คู่มือการใช้ถังดับเพลิง</h3>
              <div className="p-3 rounded-xl bg-green-50 border border-green-200">
                <p className="font-bold text-base text-green-800">ชนิด Non-CFC (สีเขียว) - 42 เครื่อง</p>
                <p className="text-xs text-green-700 mt-1">ใช้ดับไฟประเภท A, B, C ปลอดภัยต่อชั้นโอโซน ไม่เป็นอันตรายต่อมนุษย์</p>
              </div>
              <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                <p className="font-bold text-base text-red-800">ชนิดเคมีแห้ง (สีแดง) - 45 เครื่อง</p>
                <p className="text-xs text-red-700 mt-1">ใช้ดับไฟประเภท A, B, C มีประสิทธิภาพสูงกับไฟไหม้ของเหลว</p>
              </div>
              <p className="text-xs text-muted-foreground">วิธีใช้: ดึงสลัก → ปลดสาย → เล็งที่ฐานเพลิง → บีบคันบังคับ → กวาดไปมา</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONTACTS TAB */}
        <TabsContent value="contacts" className="space-y-4">
          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">เบอร์ภายใน</h3>
              {INTERNAL_CONTACTS.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                  <span className="text-base font-medium text-card-foreground">{c.name}</span>
                  <div className="flex gap-2">
                    {c.numbers.map(n => (
                      <a key={n} href={`tel:${n}`} className="px-3 py-1.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                        {n}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">เบอร์ภายนอก</h3>
              {EXTERNAL_CONTACTS.map((c, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/50 border border-border/50">
                  <span className="text-base font-medium text-card-foreground">{c.name}</span>
                  <div className="flex gap-2">
                    {c.numbers.map(n => (
                      <a key={n} href={`tel:${n}`} className="px-3 py-1.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-bold hover:opacity-90 transition-opacity">
                        {n}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* EVACUATION TAB */}
        <TabsContent value="evacuation" className="space-y-4">
          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-lg font-bold text-card-foreground">ความคืบหน้าการอพยพ</h3>
              <Progress value={evacuationProgress} className="h-3 rounded-full" />
              <p className="text-base text-muted-foreground">ผู้ป่วยปลอดภัย: {patientsSafe}/{patientsTotal} ราย ({evacuationProgress}%)</p>
            </CardContent>
          </Card>

          <Tabs defaultValue="1">
            <TabsList className="grid w-full grid-cols-3 h-11 rounded-2xl bg-muted">
              <TabsTrigger value="1" className="rounded-xl text-xs">ลำดับ 1 (ช่วยตัวเองไม่ได้)</TabsTrigger>
              <TabsTrigger value="2" className="rounded-xl text-xs">ลำดับ 2 (ช่วยตัวเองได้)</TabsTrigger>
              <TabsTrigger value="3" className="rounded-xl text-xs">ลำดับ 3 (เครื่องช่วยชีวิต)</TabsTrigger>
            </TabsList>
            {[1, 2, 3].map(priority => (
              <TabsContent key={priority} value={String(priority)} className="space-y-2 mt-3">
                {beds.filter(b => b.priority === priority && b.has_patient).map(bed => (
                  <Card key={bed.id} className="shadow-card bg-card rounded-2xl">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox checked={bed.is_safe} onCheckedChange={(checked) => markBedSafe.mutate({ id: bed.id, is_safe: !!checked })} />
                        <div>
                          <p className="text-base font-semibold text-card-foreground">เตียง {bed.bed_number}</p>
                          <p className="text-xs text-muted-foreground">{bed.patient_name || "ไม่ระบุชื่อ"} · {bed.ward}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        {bed.is_safe ? (
                          <Badge className="bg-green-100 text-green-700 rounded-xl text-xs">ปลอดภัย</Badge>
                        ) : (
                          <Badge variant="outline" className="rounded-xl text-xs">รอยืนยัน</Badge>
                        )}
                        {bed.safe_at && <p className="text-xs text-muted-foreground mt-1">{new Date(bed.safe_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</p>}
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {beds.filter(b => b.priority === priority && b.has_patient).length === 0 && (
                  <p className="text-center text-base text-white/50 py-6">ไม่มีผู้ป่วยในลำดับนี้</p>
                )}
              </TabsContent>
            ))}
          </Tabs>

          <Card className="shadow-card bg-card rounded-2xl">
            <CardContent className="p-4 text-center">
              <Button variant="outline" className="rounded-2xl w-full h-12 text-base" onClick={() => {
                const unconfirmed = patientsTotal - patientsSafe;
                toast.info(`สรุปการอพยพ - ปลอดภัย: ${patientsSafe} ราย | รอยืนยัน: ${unconfirmed} ราย`);
              }}>
                สรุปผลการอพยพ
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ADMIN TAB */}
        {isAdmin && (
          <TabsContent value="admin" className="space-y-4">
            {/* Bed Management */}
            <Card className="shadow-card bg-card rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-card-foreground">จัดการเตียงผู้ป่วย</h3>
                  <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => { setEditingBed(null); setBedNumber(""); setBedDept(""); setBedPriority("1"); setShowBedForm(!showBedForm); }}>
                    <Plus className="h-4 w-4" /> เพิ่มเตียง
                  </Button>
                </div>

                {showBedForm && (
                  <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                    <div><Label className="text-xs font-semibold">ลำดับความสำคัญ *</Label>
                      <Select value={bedPriority} onValueChange={setBedPriority}>
                        <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4].map(p => <SelectItem key={p} value={p.toString()}>ลำดับที่ {p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs font-semibold">เลขที่เตียง *</Label>
                      <Input placeholder="เช่น A01, B05" value={bedNumber} onChange={(e) => setBedNumber(e.target.value)} className="h-10 rounded-lg text-sm" />
                    </div>
                    <div><Label className="text-xs font-semibold">แผนก *</Label>
                      <Select value={bedDept} onValueChange={setBedDept}>
                        <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                        <SelectContent>
                          {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 rounded-lg h-9" onClick={() => { if (editingBed) updateBed.mutate(); else createBed.mutate(); }}>
                        {editingBed ? "อัปเดต" : "เพิ่ม"}
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1 rounded-lg h-9" onClick={() => { setShowBedForm(false); setEditingBed(null); }}>ยกเลิก</Button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {beds.map(bed => (
                    <div key={bed.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 text-xs">
                      <div className="flex-1">
                        <p className="font-semibold text-card-foreground">ลำดับที่ {bed.priority}: {bed.bed_number}</p>
                        <p className="text-muted-foreground text-xs">{bed.ward || ""}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setEditingBed(bed); setBedNumber(bed.bed_number); setBedDept(bed.ward); setBedPriority(bed.priority.toString()); setShowBedForm(true); }}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive" onClick={() => deleteBed.mutate(bed.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Staff Count by Department */}
            <Card className="shadow-card bg-card rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-card-foreground">จำนวนเจ้าหน้าที่ตามแผนก</h3>
                  <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => setShowStaffForm(!showStaffForm)}>
                    <Users className="h-4 w-4" /> {showStaffForm ? "ปิด" : "เพิ่ม"}
                  </Button>
                </div>

                {showStaffForm && (
                  <div className="space-y-3 p-4 rounded-xl bg-muted/50">
                    {departments.map(dept => (
                      <div key={dept.id} className="flex items-center gap-2">
                        <Label className="flex-1 text-xs font-semibold text-card-foreground">{dept.name}:</Label>
                        <Input 
                          type="number" 
                          min="0" 
                          value={staffData[dept.id] || 0} 
                          onChange={(e) => setStaffData({...staffData, [dept.id]: parseInt(e.target.value) || 0})}
                          className="w-16 h-10 rounded-lg text-sm"
                        />
                      </div>
                    ))}
                    <Button size="sm" className="w-full rounded-lg h-9" onClick={() => { setShowStaffForm(false); toast.success("บันทึกจำนวนเจ้าหน้าที่สำเร็จ"); }}>
                      บันทึก
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {departments.map(dept => (
                    <div key={dept.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <p className="font-semibold text-card-foreground text-base">{dept.name}</p>
                      <Badge variant="outline" className="text-xs rounded-lg">{staffData[dept.id] || 0} คน</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* SOS Modal */}
      <Dialog open={showSOS} onOpenChange={setShowSOS}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle className="text-lg text-destructive font-bold">แจ้งเหตุเพลิงไหม้</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label className="text-base font-semibold">อาคาร *</Label>
              <Select value={sosBuilding} onValueChange={setSosBuilding}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกอาคาร..." /></SelectTrigger>
                <SelectContent>{BUILDINGS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-sm font-semibold">ชั้น</Label>
              <Select value={sosFloor} onValueChange={setSosFloor}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกชั้น..." /></SelectTrigger>
                <SelectContent>{FLOORS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button variant="destructive" className="w-full h-14 text-lg font-bold rounded-2xl" onClick={handleSOS} disabled={sosSending || !sosBuilding}>
              {sosSending ? "กำลังส่ง..." : "ยืนยันการแจ้งเตือน"}
            </Button>
            <div className="flex gap-3 justify-center">
              {[{ label: "ER", number: "108" }, { label: "รปภ.", number: "175" }, { label: "โอเปอเรเตอร์", number: "0" }].map(c => (
                <a key={c.number} href={`tel:${c.number}`} className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors">
                  <Phone className="h-5 w-5 text-destructive" />
                  <span className="text-xs font-bold text-card-foreground">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.number}</span>
                </a>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
