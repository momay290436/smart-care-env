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
      <div className={`rounded-2xl p-3 text-center text-sm font-semibold ${allOk ? "bg-green-100 text-slate-900 border border-green-200" : "bg-red-100 text-slate-900 border border-red-200"}`}>
        ระบบดับเพลิงทั้งหมด: {allOk ? "พร้อมใช้งาน" : "พบปัญหา กรุณาตรวจสอบ"}
      </div>

      <PageHeader title="Fire Safety" subtitle="แผนป้องกันและระงับอัคคีภัย" />

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
                <span className="
