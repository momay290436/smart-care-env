import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportExcel";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "hsl(210 15% 55%)" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "hsl(0 72% 55%)" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "hsl(152 55% 42%)" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "hsl(45 90% 50%)" },
};

const PIE_COLORS = ["hsl(210 15% 55%)", "hsl(0 72% 55%)", "hsl(152 55% 42%)", "hsl(45 90% 50%)"];

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>(DEFAULT_WASTE_TYPES);
  const [manageDeptsOpen, setManageDeptsOpen] = useState(false);
  const [deptEditName, setDeptEditName] = useState("");
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [wasteType, setWasteType] = useState("general");
  const [weight, setWeight] = useState("");
  const [selectedDept, setSelectedDept] = useState(profile?.department_id || "");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [costPerKg, setCostPerKg] = useState<Record<string, number>>({ general: 2, infectious: 15, recycle: 0, hazardous: 25 });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  // Admin backdate fields
  const [customDateTime, setCustomDateTime] = useState("");
  const [customRecorder, setCustomRecorder] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  // load persisted waste types and costs from app_settings
  useEffect(() => {
    (async () => {
      try {
        const { data: wt } = await supabase.from("app_settings").select("value").eq("key", "waste_types").maybeSingle();
        if (wt && wt.value) {
          const parsed = JSON.parse(wt.value);
          if (parsed && typeof parsed === "object") setTypesMap(parsed);
        }
        const { data: wc } = await supabase.from("app_settings").select("value").eq("key", "waste_costs").maybeSingle();
        if (wc && wc.value) {
          const parsed = JSON.parse(wc.value);
          if (parsed && typeof parsed === "object") setCostPerKg(parsed);
        }
      } catch (e) {}
    })();
  }, []);

  const { data: logs = [] } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("waste_logs")
        .select("*, departments(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const { data: infectiousWasteRecords = [] } = useQuery({
    queryKey: ["infectious-waste"],
    queryFn: async () => {
      const { data } = await supabase
        .from("infectious_waste_records")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const createLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const w = parseFloat(weight);
      const payload: any = {
        waste_type: wasteType,
        weight: w,
        department_id: selectedDept || profile?.department_id || null,
        recorded_by: user.id,
      };
      if (isAdmin && customDateTime) {
        payload.created_at = new Date(customDateTime).toISOString();
      }
      const { error } = await supabase.from("waste_logs").insert(payload);
      if (error) throw error;

      // Line notify for high-weight infectious waste
      if (wasteType === "infectious" && w >= 10) {
        try {
          const deptName = departments.find(d => d.id === selectedDept)?.name || "ไม่ระบุ";
          await supabase.functions.invoke("line-notify", {
            body: { message: `🔴 แจ้งเตือน: บันทึกขยะติดเชื้อน้ำหนักสูง ${w} กก.\nแผนก: ${deptName}\nผู้บันทึก: ${profile?.full_name}` },
          });
        } catch {}
      }
    },
    onSuccess: () => {
      toast.success("บันทึกน้ำหนักขยะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      setShowForm(false);
      setWeight("");
      setCustomDateTime("");
      setCustomRecorder("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDepartment = useMutation({
    mutationFn: async ({ id, name }: { id?: string | null; name: string }) => {
      if (!name.trim()) throw new Error("กรุณาระบุชื่อแผนก");
      if (id) {
        const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert({ name: name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกแผนกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeptEditId(null);
      setDeptEditName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบแผนกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const typeValue = JSON.stringify(typesMap);
      const costValue = JSON.stringify(costPerKg);

      const { data: existingTypes } = await supabase.from("app_settings").select("id").eq("key", "waste_types").maybeSingle();
      if (existingTypes) {
        await supabase.from("app_settings").update({ value: typeValue }).eq("key", "waste_types");
      } else {
        await supabase.from("app_settings").insert({ key: "waste_types", value: typeValue });
      }

      const { data: existingCosts } = await supabase.from("app_settings").select("id").eq("key", "waste_costs").maybeSingle();
      if (existingCosts) {
        await supabase.from("app_settings").update({ value: costValue }).eq("key", "waste_costs");
      } else {
        await supabase.from("app_settings").insert({ key: "waste_costs", value: costValue });
      }
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (filterType !== "all" && log.waste_type !== filterType) return false;
      const created = new Date(log.created_at);
      const now = new Date();
      if (filterPeriod === "day" && created < startOfDay(now)) return false;
      if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
      if (filterPeriod === "month" && created < startOfMonth(now)) return false;
      if (filterPeriod === "custom" && customFrom && customTo) {
        if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
      }
      return true;
    });
  }, [logs, filterType, filterPeriod, customFrom, customTo]);

  // Chart data
  const chartData = useMemo(() => {
    const dayMap: Record<string, { sortKey: string; label: string; types: Record<string, number> }> = {};
    const typeMap: Record<string, number> = {};
    const deptMap: Record<string, Record<string, number>> = {};

    filteredLogs.forEach((log: any) => {
      const d = new Date(log.created_at);
      const sortKey = format(d, "yyyy-MM-dd");
      const label = format(d, "d MMM", { locale: th });
      const wt = typesMap[log.waste_type]?.label || log.waste_type;
      const dept = log.departments?.name || "ไม่ระบุ";
      const w = Number(log.weight);

      if (!dayMap[sortKey]) dayMap[sortKey] = { sortKey, label, types: {} };
      dayMap[sortKey].types[wt] = (dayMap[sortKey].types[wt] || 0) + w;

      typeMap[wt] = (typeMap[wt] || 0) + w;

      if (!deptMap[dept]) deptMap[dept] = {};
      deptMap[dept][wt] = (deptMap[dept][wt] || 0) + w;
    });

    // Add infectious waste data from infectious_waste_records
    const infectiousLabel = typesMap.infectious?.label || "ขยะติดเชื้อ";
    infectiousWasteRecords.forEach((record: any) => {
      const d = new Date(record.collection_date);
      const sortKey = format(d, "yyyy-MM-dd");
      const label = format(d, "d MMM", { locale: th });
      const sharpWaste = Number(record.sharp_waste_kg) || 0;
      const nonSharpWaste = Number(record.non_sharp_waste_kg) || 0;
      const totalWaste = sharpWaste + nonSharpWaste;

      if (totalWaste > 0) {
        if (!dayMap[sortKey]) dayMap[sortKey] = { sortKey, label, types: {} };
        dayMap[sortKey].types[infectiousLabel] = (dayMap[sortKey].types[infectiousLabel] || 0) + totalWaste;
        typeMap[infectiousLabel] = (typeMap[infectiousLabel] || 0) + totalWaste;
      }
    });

    const lineData = Object.values(dayMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ label, types }) => {
        const row: Record<string, any> = { date: label };
        Object.values(typesMap).forEach((t) => { row[t.label] = Math.round((types[t.label] || 0) * 100) / 100; });
        return row;
      });
    const pieData = Object.entries(typeMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
    const deptData = Object.entries(deptMap).map(([dept, types]) => ({
      dept,
      ...types,
      total: Object.values(types).reduce((a, b) => a + b, 0),
    }));
    const totalWeight = filteredLogs.reduce((s: number, l: any) => s + Number(l.weight), 0);

    return { lineData, pieData, deptData, totalWeight: Math.round(totalWeight * 100) / 100 };
  }, [filteredLogs, infectiousWasteRecords, typesMap]);

  // Cost calculation
  const totalCost = useMemo(() => {
    let cost = 0;
    filteredLogs.forEach((log: any) => {
      const rate = costPerKg[log.waste_type] || 0;
      cost += Number(log.weight) * rate;
    });
    return Math.round(cost * 100) / 100;
  }, [filteredLogs, costPerKg]);

  const handleAdvancedExport = () => {
    const wb = XLSX.utils.book_new();
    const deptNames = departments.map((d: any) => d.name).sort();
    const now2 = new Date();
    const yr = now2.getFullYear();
    const mo = now2.getMonth();
    const dim = new Date(yr, mo + 1, 0).getDate();
    ["general", "infectious"].forEach((type) => {
      const sn = type === "general" ? "ขยะทั่วไป" : "ขยะเปียก";
      const h1: any[] = ["ลำดับ", "แผนก"];
      const h2: any[] = ["", ""];
      for (let d = 1; d <= dim; d++) { h1.push(`${d}`, ""); h2.push("เช้า", "บ่าย"); }
      h1.push("รวม"); h2.push("");
      const dr: any[][] = [];
      deptNames.forEach((dn: string, idx: number) => {
        const row: any[] = [idx + 1, dn];
        let total = 0;
        for (let d = 1; d <= dim; d++) {
          const ds = `${yr}-${String(mo + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const am = logs.filter((l: any) => { const ld = new Date(l.created_at); return l.waste_type === type && l.departments?.name === dn && format(ld, "yyyy-MM-dd") === ds && ld.getHours() < 12; }).reduce((s: number, l: any) => s + Number(l.weight), 0);
          const pm = logs.filter((l: any) => { const ld = new Date(l.created_at); return l.waste_type === type && l.departments?.name === dn && format(ld, "yyyy-MM-dd") === ds && ld.getHours() >= 12; }).reduce((s: number, l: any) => s + Number(l.weight), 0);
          row.push(am || "", pm || ""); total += am + pm;
        }
        row.push(total || ""); dr.push(row);
      });
      const ws = XLSX.utils.aoa_to_sheet([h1, h2, ...dr]);
      const mg: XLSX.Range[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }];
      for (let d = 0; d < dim; d++) mg.push({ s: { r: 0, c: 2 + d * 2 }, e: { r: 0, c: 3 + d * 2 } });
      mg.push({ s: { r: 0, c: 2 + dim * 2 }, e: { r: 1, c: 2 + dim * 2 } });
      ws["!merges"] = mg;
      XLSX.utils.book_append_sheet(wb, ws, sn);
    });
    XLSX.writeFile(wb, `waste-report-${format(now2, "yyyy-MM")}.xlsx`);
    toast.success("ส่งออกรายงานขยะประจำเดือนสำเร็จ");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูลขยะ" subtitle="บันทึก วิเคราะห์ และคำนวณต้นทุน">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1" onClick={handleAdvancedExport}>
          <Download className="h-3.5 w-3.5" /> รายงานเดือน
        </Button>
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1" onClick={() => {
          exportToExcel(filteredLogs.map((l: any) => ({
            "วันที่": new Date(l.created_at).toLocaleDateString("th-TH"),
            "ประเภทขยะ": typesMap[l.waste_type]?.label || l.waste_type,
            "น้ำหนัก (กก.)": l.weight,
            "แผนก": l.departments?.name || "-",
          })), "waste-logs", "บันทึกขยะ");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>📊 Excel</Button>
      </PageHeader>

      {/* Prominent record button */}
      <Button
        className="w-full h-14 rounded-2xl text-base font-bold gap-2 shadow-elevated bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        onClick={() => setShowForm(true)}
      >
        <Plus className="h-5 w-5" /> บันทึกน้ำหนักขยะ
      </Button>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-12 rounded-2xl bg-muted/60">
          <TabsTrigger value="dashboard" className="rounded-xl text-base font-semibold">แดชบอร์ด</TabsTrigger>
          <TabsTrigger value="records" className="rounded-xl text-base font-semibold">รายการ</TabsTrigger>
          <TabsTrigger value="cost" className="rounded-xl text-base font-semibold">ต้นทุน</TabsTrigger>
          <TabsTrigger value="infectious" className="rounded-xl text-sm font-semibold">ขยะติดเชื้อ</TabsTrigger>
        </TabsList>

        <Card className="shadow-lg mt-4 border border-slate-200 rounded-2xl bg-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 text-sm w-32 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {Object.entries(typesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-10 text-sm w-28 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="day">วันนี้</SelectItem>
                  <SelectItem value="week">สัปดาห์นี้</SelectItem>
                  <SelectItem value="month">เดือนนี้</SelectItem>
                  <SelectItem value="custom">เลือกวันที่</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="h-10 px-4 flex items-center text-sm rounded-2xl">{filteredLogs.length} รายการ</Badge>
            </div>
            {filterPeriod === "custom" && (
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl font-semibold", !customFrom ? "text-slate-900 border-slate-400" : "text-slate-900 border-slate-400")}>
                      {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl font-semibold", !customTo ? "text-slate-900 border-slate-400" : "text-slate-900 border-slate-400")}>
                      {customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="shadow-lg border-0 rounded-3xl bg-gradient-to-br from-sky-50 to-sky-100/50 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-extrabold text-sky-600">{chartData.totalWeight}</p>
                <p className="text-xs text-muted-foreground mt-1">น้ำหนักรวม (กก.)</p>
              </CardContent>
            </Card>
            {Object.entries(typesMap).map(([k, v]) => {
              const typeWeight = filteredLogs.filter((l: any) => l.waste_type === k).reduce((s: number, l: any) => s + Number(l.weight), 0);
              return (
                <Card key={k} className="shadow-lg border-0 rounded-3xl bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 rounded-full mx-auto mb-2 shadow-sm" style={{ background: v.chartColor, opacity: 0.8 }} />
                    <p className="text-2xl font-extrabold" style={{ color: v.chartColor }}>{Math.round(typeWeight * 100) / 100}</p>
                    <p className="text-xs text-muted-foreground mt-1">{v.label} (กก.)</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {chartData.lineData.length > 0 && (
            <Card className="shadow-card border border-border/50 rounded-3xl bg-white">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">แนวโน้มขยะรายวัน</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">น้ำหนักรวมแต่ละประเภท (กก.)</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData.lineData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 92%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", fontSize: 12 }}
                      formatter={(value: number, name: string) => [`${value} กก.`, name]}
                      labelStyle={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}
                    />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {Object.entries(typesMap).map(([_, wt]) => (
                      <Bar
                        key={wt.label}
                        dataKey={wt.label}
                        fill={wt.chartColor}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {chartData.pieData.length > 0 && (
            <Card className="shadow-card border border-border/50 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">สัดส่วนขยะแต่ละประเภท</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={chartData.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={4} dataKey="value">
                      {chartData.pieData.map((item: any) => {
                        const typeEntry = Object.entries(typesMap).find(([_, v]) => v.label === item.name);
                        const color = typeEntry ? typeEntry[1].chartColor : "hsl(210 15% 55%)";
                        return <Cell key={item.name} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} กก.`} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {infectiousWasteRecords.length > 0 && (
            <Card className="shadow-card border border-red-200/50 rounded-3xl bg-gradient-to-br from-red-50 to-red-50/30">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: "hsl(0 72% 55%)" }} />
                  ข้อมูลขยะติดเชื้อ
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">ขยะแหลม</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Math.round(infectiousWasteRecords.reduce((sum: number, r: any) => sum + (Number(r.sharp_waste_kg) || 0), 0) * 100) / 100}
                    </p>
                    <p className="text-xs text-muted-foreground">กก.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">ขยะไม่แหลม</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {Math.round(infectiousWasteRecords.reduce((sum: number, r: any) => sum + (Number(r.non_sharp_waste_kg) || 0), 0) * 100) / 100}
                    </p>
                    <p className="text-xs text-muted-foreground">กก.</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-red-200/50">
                  <p className="text-xs text-muted-foreground mb-2">บันทึกล่าสุด (รับเข้าวันที่):</p>
                  <div className="space-y-2">
                    {infectiousWasteRecords.slice(0, 3).map((record: any) => (
                      <div key={record.id} className="text-xs flex items-center justify-between">
                        <span className="text-foreground">{record.health_center_name || "ไม่ระบุ"}</span>
                        <span className="text-muted-foreground">{new Date(record.collection_date || record.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-3 mt-4">
          {filteredLogs.map((log: any) => {
            const wt = typesMap[log.waste_type] || typesMap.general;
            return (
              <Card key={log.id} className="group relative overflow-hidden rounded-3xl border-0 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer hover:-translate-y-1 animate-fade-in bg-white/70 backdrop-blur-md" onClick={() => setSelectedLog(log)}>
                <div className="absolute inset-0 opacity-[0.05] rounded-3xl" style={{ background: `linear-gradient(135deg, ${wt.chartColor}, transparent)` }} />
                <CardContent className="relative flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm" style={{ background: `${wt.chartColor}20` }}>
                      <div className="w-4 h-4 rounded-full" style={{ background: wt.chartColor }} />
                    </div>
                    <div>
                      <Badge className={`${wt.color} border rounded-xl text-xs`} variant="secondary">{wt.label}</Badge>
                      <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                        {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{log.departments?.name || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xl font-extrabold text-foreground">{log.weight}</p>
                      <p className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">กก.</p>
                    </div>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive/60 hover:text-destructive rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); if (confirm("ยืนยันลบ?")) deleteLog.mutate(log.id); }}>
                        ✕
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredLogs.length === 0 && (
            <Card className="shadow-card border-0 rounded-2xl bg-white/80 backdrop-blur-sm">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <p className="text-base text-muted-foreground">ไม่มีบันทึกขยะในช่วงที่เลือก</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cost" className="space-y-4 mt-4">
          <Card className="shadow-elevated border-0 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">ค่าใช้จ่ายกำจัดขยะ (ประมาณ)</p>
              <p className="text-4xl font-extrabold text-primary">{totalCost.toLocaleString()} <span className="text-lg font-normal text-muted-foreground">บาท</span></p>
              <p className="text-xs text-muted-foreground mt-2">จากขยะ {chartData.totalWeight} กก.</p>
            </CardContent>
          </Card>

          {/* Cost breakdown bar chart */}
          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">กราฟค่าใช้จ่ายตามประเภทขยะ</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={Object.entries(typesMap).map(([k, v]) => {
                  const typeWeight = filteredLogs.filter((l: any) => l.waste_type === k).reduce((s: number, l: any) => s + Number(l.weight), 0);
                  return { name: v.label, weight: Math.round(typeWeight * 100) / 100, cost: Math.round(typeWeight * (costPerKg[k] || 0) * 100) / 100, fill: v.chartColor };
                })} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}฿`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(v: number, name: string) => name === "cost" ? [`${v} ฿`, "ค่าใช้จ่าย"] : [`${v} กก.`, "น้ำหนัก"]} />
                  <Bar dataKey="cost" radius={[0, 8, 8, 0]}>
                    {Object.values(typesMap).map((v, i) => <Cell key={i} fill={v.chartColor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost trend area chart */}
          {chartData.lineData.length > 1 && (
            <Card className="shadow-card border border-border/50 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">แนวโน้มค่าใช้จ่ายรายวัน</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData.lineData.map(d => {
                    let dailyCost = 0;
                    Object.entries(typesMap).forEach(([, v]) => {
                      const w = (d as any)[v.label] || 0;
                      const k = Object.entries(typesMap).find(([, vv]) => vv.label === v.label)?.[0] || "general";
                      dailyCost += w * (costPerKg[k] || 0);
                    });
                    return { date: d.date, cost: Math.round(dailyCost * 100) / 100 };
                  })}>
                    <defs>
                      <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 90%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}฿`} />
                    <Tooltip formatter={(v: number) => [`${v} ฿`, "ค่าใช้จ่าย"]} />
                    <Area type="monotone" dataKey="cost" stroke="hsl(var(--primary))" fill="url(#costGradient)" strokeWidth={2.5} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-base font-bold text-foreground">ตั้งค่าราคาค่ากำจัด (บาท/กก.)</h3>
              {Object.entries(typesMap).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                    <Badge className={`${v.color} border rounded-xl`} variant="secondary">{v.label}</Badge>
                  </div>
                  <Input type="number" step="0.5" min="0" value={costPerKg[k] || 0} onChange={(e) => setCostPerKg(prev => ({ ...prev, [k]: Number(e.target.value) }))} className="w-24 h-10 text-right rounded-2xl" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="h-12 rounded-2xl" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>
              {saveWasteSettings.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </div>

          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">รายละเอียดค่าใช้จ่าย</h3>
              <div className="space-y-2">
                {Object.entries(typesMap).map(([k, v]) => {
                  const typeWeight = filteredLogs.filter((l: any) => l.waste_type === k).reduce((s: number, l: any) => s + Number(l.weight), 0);
                  const typeCost = typeWeight * (costPerKg[k] || 0);
                  const pct = totalCost > 0 ? Math.round((typeCost / totalCost) * 100) : 0;
                  return (
                    <div key={k} className="space-y-1.5 py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                          <span className="text-base font-medium">{v.label}</span>
                        </div>
                        <span className="font-bold text-primary">{Math.round(typeCost * 100) / 100} ฿</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: v.chartColor }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{Math.round(typeWeight * 100) / 100} กก. × {costPerKg[k]} ฿/กก.</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infectious" className="mt-4">
          <InfectiousWasteTab />
        </TabsContent>
      </Tabs>

      {/* Add waste form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle>บันทึกน้ำหนักขยะ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">แผนก</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ สามารถจัดการรายการแผนกได้</span>
                  <Button size="sm" variant="outline" className="h-10 rounded-2xl" onClick={() => setManageDeptsOpen(true)}>
                    จัดการ
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">ประเภทขยะ</Label>
              <Select value={wasteType} onValueChange={setWasteType}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typesMap).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                        <span>{v.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ สามารถจัดการรายการประเภทขยะได้</span>
                  <Button size="sm" variant="outline" className="h-10 rounded-2xl" onClick={() => setManageTypesOpen(true)}>
                    จัดการ
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">น้ำหนัก (กก.)</Label>
              <Input type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" className="text-lg h-12 rounded-2xl" />
            </div>
            {isAdmin && (
              <div className="space-y-3 rounded-2xl bg-blue-50/50 p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-700">⚙ ตัวเลือกผู้ดูแล (ลงข้อมูลย้อนหลัง)</p>
                <div className="space-y-1">
                  <Label className="text-xs">วัน/เดือน/ปี และเวลา (เว้นว่าง = ใช้เวลาปัจจุบัน)</Label>
                  <Input type="datetime-local" value={customDateTime} onChange={(e) => setCustomDateTime(e.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>
            )}
            <Button className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg" onClick={() => createLog.mutate()} disabled={createLog.isPending || !weight}>
              {createLog.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>รายละเอียดบันทึกขยะ</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-base">
                  <div className="flex justify-between"><span className="text-muted-foreground">ประเภท:</span><Badge className={`${typesMap[selectedLog.waste_type]?.color} border`} variant="secondary">{typesMap[selectedLog.waste_type]?.label}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">น้ำหนัก:</span><span className="font-bold text-foreground">{selectedLog.weight} กก.</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">แผนก:</span><span className="text-foreground">{selectedLog.departments?.name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">วันที่:</span><span className="text-foreground">{new Date(selectedLog.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manageDeptsOpen} onOpenChange={setManageDeptsOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>จัดการแผนก</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {departments.map((dept: any) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{dept.name}</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => { setDeptEditId(dept.id); setDeptEditName(dept.name); }}>
                    แก้ไข
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-2xl text-destructive" onClick={() => deleteDepartment.mutate(dept.id)}>
                    ลบ
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-3 p-4 rounded-3xl border border-border/70 bg-slate-50">
              <Label className="text-sm font-semibold">เพิ่ม / แก้ไขแผนก</Label>
              <Input placeholder="ชื่อแผนก" value={deptEditName} onChange={(e) => setDeptEditName(e.target.value)} className="h-12 rounded-2xl" />
              <div className="flex gap-2 flex-wrap">
                <Button className="h-12 rounded-2xl" onClick={() => saveDepartment.mutate({ id: deptEditId, name: deptEditName })} disabled={saveDepartment.isPending || !deptEditName.trim()}>
                  {saveDepartment.isPending ? "กำลังบันทึก..." : deptEditId ? "อัปเดต" : "เพิ่ม"}
                </Button>
                {deptEditId && (
                  <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => { setDeptEditId(null); setDeptEditName(""); }}>
                    ยกเลิก
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageTypesOpen} onOpenChange={setManageTypesOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>จัดการประเภทขยะ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {Object.entries(typesMap).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-2 rounded-3xl border border-border/50 p-3 bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: value.chartColor }} />
                      <span className="font-medium">{key}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      const copy = { ...typesMap };
                      delete copy[key];
                      setTypesMap(copy);
                    }}>
                      ลบ
                    </Button>
                  </div>
                  <Input value={value.label} onChange={(e) => setTypesMap(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value } }))} className="h-12 rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="space-y-3 p-4 rounded-3xl border border-border/70 bg-slate-50">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="คีย์ใหม่ เช่น special" value={newTypeKey} onChange={(e) => setNewTypeKey(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="ป้ายชื่อใหม่" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} className="h-12 rounded-2xl" />
              </div>
              <Button className="h-12 rounded-2xl" onClick={() => {
                const trimmedKey = newTypeKey.trim();
                const trimmedLabel = newTypeLabel.trim();
                if (!trimmedKey || !trimmedLabel) {
                  toast.error("กรุณากรอกคีย์และป้ายชื่อ");
                  return;
                }
                if (typesMap[trimmedKey]) {
                  toast.error("คีย์นี้มีอยู่แล้ว");
                  return;
                }
                setTypesMap(prev => ({
                  ...prev,
                  [trimmedKey]: {
                    label: trimmedLabel,
                    color: "bg-slate-200 text-slate-800 border-slate-300",
                    chartColor: "hsl(210 15% 55%)",
                  },
                }));
                setNewTypeKey("");
                setNewTypeLabel("");
              }}>
                เพิ่มประเภทใหม่
              </Button>
            </div>
            <Button className="w-full h-12 rounded-2xl" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>
              {saveWasteSettings.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
