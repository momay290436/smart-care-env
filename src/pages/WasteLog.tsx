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

type FilterPeriod = "day" | "week" | "month" | "all" | "custom";

const DEFAULT_TYPES_MAP: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-teal-50 text-teal-700 border-teal-200", chartColor: "#26a69a" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-rose-50 text-rose-700 border-rose-200", chartColor: "#ef5350" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-blue-50 text-blue-700 border-blue-200", chartColor: "#42a5f5" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-50 text-amber-700 border-amber-200", chartColor: "#ffa726" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-50 text-emerald-700 border-emerald-200", chartColor: "#66bb6a" },
};

const normalizeWasteType = (type: string) => {
  const key = String(type || "").trim().toLowerCase();
  if (key === "recyclable") return "recycle";
  if (key === "organic waste" || key === "organic" || key === "ขยะเปียก") return "organic";
  if (key === "general waste" || key === "ขยะทั่วไป") return "general";
  if (key === "ขยะรีไซเคิล") return "recycle";
  if (key === "ขยะติดเชื้อ") return "infectious";
  if (key === "ขยะอันตราย") return "hazardous";
  return key || "other";
};

export default function WasteLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"logs" | "charts">("logs");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<FilterPeriod>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [wasteType, setWasteType] = useState<string>("general");
  const [weight, setWeight] = useState<string>("");
  const [collector, setCollector] = useState<string>("");
  const [notes, setNotes] = useState<string>("");

  const [typesMap, setTypesMap] = useState(DEFAULT_TYPES_MAP);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const { data: appSettings } = useQuery({
    queryKey: ["waste-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "waste_types_config").maybeSingle();
      if (data?.value) { try { return JSON.parse(data.value); } catch { return null; } }
      return null;
    },
  });

  useEffect(() => { if (appSettings) setTypesMap(appSettings); }, [appSettings]);

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      await supabase.from("app_settings").upsert({ key: "waste_types_config", value: JSON.stringify(typesMap) }, { onConflict: "key" });
    },
    onSuccess: () => { toast.success("บันทึกการตั้งค่าแล้ว"); setIsSettingsOpen(false); queryClient.invalidateQueries({ queryKey: ["waste-settings"] }); },
  });

  const { data: wasteLogs, isLoading } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("waste_logs").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const dateRange = useMemo(() => {
    const now = new Date();
    if (filterPeriod === "day") return { from: startOfDay(now), to: now };
    if (filterPeriod === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: now };
    if (filterPeriod === "month") return { from: startOfMonth(now), to: now };
    if (filterPeriod === "custom" && customFrom && customTo) {
      return { from: startOfDay(customFrom), to: new Date(startOfDay(customTo).getTime() + 86400000 - 1) };
    }
    return null;
  }, [filterPeriod, customFrom, customTo]);

  const filteredLogs = useMemo(() => {
    let logs = wasteLogs || [];
    if (filterType !== "all") {
      logs = logs.filter((l) => normalizeWasteType(l.waste_type) === normalizeWasteType(filterType));
    }
    if (dateRange) {
      logs = logs.filter((l) => {
        const d = new Date(l.created_at);
        return d >= dateRange.from && d <= dateRange.to;
      });
    }
    return logs;
  }, [wasteLogs, filterType, dateRange]);

  const combinedLogs = useMemo(() => {
    return filteredLogs;
  }, [filteredLogs]);

  const totalWeight = useMemo(() => {
    return Number(combinedLogs.reduce((sum, item) => sum + Number(item.weight || 0), 0).toFixed(2));
  }, [combinedLogs]);

  const chartData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    combinedLogs.forEach((item) => {
      const dayStr = format(new Date(item.created_at), "d MMM", { locale: th });
      const type = normalizeWasteType(item.waste_type);
      if (!map[dayStr]) map[dayStr] = {};
      map[dayStr][type] = (map[dayStr][type] || 0) + Number(item.weight || 0);
    });
    return Object.entries(map).map(([date, types]) => {
      const row: any = { date };
      Object.keys(typesMap).forEach((t) => { row[t] = Number((types[t] || 0).toFixed(2)); });
      return row;
    });
  }, [combinedLogs, typesMap]);

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    combinedLogs.forEach((item) => {
      const type = normalizeWasteType(item.waste_type);
      map[type] = (map[type] || 0) + Number(item.weight || 0);
    });
    return Object.entries(map).map(([type, weight]) => ({
      name: typesMap[type]?.label || type,
      value: Number(weight.toFixed(2)),
      color: typesMap[type]?.chartColor || "#cbd5e1",
    })).filter((d) => d.value > 0);
  }, [combinedLogs, typesMap]);

  const createLog = useMutation({
    mutationFn: async () => {
      const payload = { waste_type: wasteType, weight: parseFloat(weight), collector, notes, created_by: user?.id };
      if (editingId) {
        await supabase.from("waste_logs").update(payload).eq("id", editingId);
      } else {
        await supabase.from("waste_logs").insert(payload);
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกข้อมูลขยะสำเร็จ");
      setIsFormOpen(false); setEditingId(null); setWeight(""); setCollector(""); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      queryClient.invalidateQueries({ queryKey: ["waste-filtered"] });
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => { await supabase.from("waste_logs").delete().eq("id", id); },
    onSuccess: () => { toast.success("ลบข้อมูลสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["waste-logs"] }); queryClient.invalidateQueries({ queryKey: ["waste-filtered"] }); },
  });

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="ระบบจัดการขยะและสิ่งแวดล้อม" subtitle="บันทึกและติดตามปริมาณขยะของโรงพยาบาล">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="rounded-2xl" onClick={() => setIsSettingsOpen(true)}>ตั้งค่าประเภท</Button>
          <Button size="sm" variant="outline" className="rounded-2xl gap-1.5" onClick={() => {
            if (combinedLogs.length === 0) { toast.error("ไม่มีข้อมูลให้ส่งออก"); return; }
            exportToExcel(combinedLogs.map((l) => ({
              "วันที่บันทึก": format(new Date(l.created_at), "d MMM yyyy HH:mm", { locale: th }),
              "ประเภทขยะ": typesMap[normalizeWasteType(l.waste_type)]?.label || l.waste_type,
              "น้ำหนัก (กก.)": l.weight,
              "ผู้บันทึก/ผู้จัดเก็บ": l.collector || "-",
              "หมายเหตุ": l.notes || "-",
            })), "รายการบันทึกขยะ");
          }}><Download className="h-4 w-4" /> ส่งออก Excel</Button>
          <Button size="sm" className="rounded-2xl bg-[#0097a7] text-slate-900 hover:bg-[#00838f] gap-1.5" onClick={() => { setEditingId(null); setIsFormOpen(true); }}><Plus className="h-4 w-4" /> บันทึกขยะ</Button>
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-500">น้ำหนักรวมตามช่วงเวลาที่เลือก</p><p className="text-3xl font-bold mt-2 text-slate-900">{totalWeight} <span className="text-base font-normal text-slate-500">กก.</span></p></CardContent></Card>
        <Card className="bg-white border shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-500">ประเภทขยะที่บันทึก</p><p className="text-3xl font-bold mt-2 text-slate-900">{pieData.length} <span className="text-base font-normal text-slate-500">ประเภท</span></p></CardContent></Card>
        <Card className="bg-white border shadow-sm"><CardContent className="p-6"><p className="text-sm font-medium text-slate-500">จำนวนครั้งที่บันทึกข้อมูล</p><p className="text-3xl font-bold mt-2 text-slate-900">{combinedLogs.length} <span className="text-base font-normal text-slate-500">ครั้ง</span></p></CardContent></Card>
      </div>

      <div className="bg-white p-4 rounded-2xl border space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="w-auto">
            <TabsList className="bg-slate-100 rounded-xl p-1"><TabsTrigger value="logs" className="rounded-lg px-4 text-sm">รายการบันทึก</TabsTrigger><TabsTrigger value="charts" className="rounded-lg px-4 text-sm">แผนภูมิสถิติ</TabsTrigger></TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40 rounded-xl"><SelectValue placeholder="ประเภทขยะ" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="all">ทุกประเภท</SelectItem>{Object.entries(typesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
            </Select>

            <Select value={filterPeriod} onValueChange={(v: any) => setFilterPeriod(v)}>
              <SelectTrigger className="w-36 rounded-xl"><SelectValue placeholder="ช่วงเวลา" /></SelectTrigger>
              <SelectContent className="bg-white"><SelectItem value="day">วันนี้</SelectItem><SelectItem value="week">สัปดาห์นี้</SelectItem><SelectItem value="month">เดือนนี้</SelectItem><SelectItem value="all">ทั้งหมด</SelectItem><SelectItem value="custom">เลือกช่วงวัน</SelectItem></SelectContent>
            </Select>

            {filterPeriod === "custom" && (
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" size="sm" className="rounded-xl">{customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "เริ่ม"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white"><Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} /></PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild><Button variant="outline" size="sm" className="rounded-xl">{customTo ? format(customTo, "d MMM yy", { locale: th }) : "สิ้นสุด"}</Button></PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white"><Calendar mode="single" selected={customTo} onSelect={setCustomTo} /></PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        </div>

        {activeTab === "logs" ? (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm text-left text-slate-600">
              <thead className="text-xs text-slate-700 bg-slate-50 uppercase font-semibold">
                <tr><th className="px-6 py-4">วันที่บันทึก</th><th className="px-6 py-4">ประเภทขยะ</th><th className="px-6 py-4 text-right">น้ำหนัก (กก.)</th><th className="px-6 py-4">ผู้บันทึก</th><th className="px-6 py-4">หมายเหตุ</th><th className="px-6 py-4 text-center">จัดการ</th></tr>
              </thead>
              <tbody className="divide-y">
                {isLoading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">กำลังโหลดข้อมูล...</td></tr>
                ) : combinedLogs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-slate-400">ไม่พบรายการบันทึกข้อมูลขยะในช่วงนี้</td></tr>
                ) : (
                  combinedLogs.map((log) => {
                    const normType = normalizeWasteType(log.waste_type);
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-700">{format(new Date(log.created_at), "d MMM yyyy HH:mm", { locale: th })}</td>
                        <td className="px-6 py-4"><Badge variant="outline" className={cn("rounded-full font-medium px-2.5 py-0.5 border", typesMap[normType]?.color || "bg-slate-100 text-slate-800")}>{typesMap[normType]?.label || log.waste_type}</Badge></td>
                        <td className="px-6 py-4 text-right font-bold text-slate-900">{log.weight}</td>
                        <td className="px-6 py-4 text-slate-600">{log.collector || "-"}</td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{log.notes || "-"}</td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <div className="flex justify-center gap-1.5">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 rounded-lg hover:bg-slate-100" onClick={() => { setEditingId(log.id); setWasteType(normType); setWeight(String(log.weight)); setCollector(log.collector || ""); setNotes(log.notes || ""); setIsFormOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 rounded-lg hover:bg-rose-50" onClick={() => { if(confirm("ยืนยันลบรายการนี้?")) deleteLog.mutate(log.id); }}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
            {pieData.length > 0 ? (
              <>
                <div className="lg:col-span-2 border rounded-xl p-4 bg-slate-50/40">
                  <h4 className="text-sm font-semibold text-slate-700 mb-4">กราฟแสดงแนวโน้มปริมาณขยะรายวัน</h4>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      {Object.keys(typesMap).map((t, idx) => <Bar key={t} dataKey={t} name={typesMap[t]?.label} fill={typesMap[t]?.chartColor} stackId="waste" radius={idx === Object.keys(typesMap).length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]} />)}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="border rounded-xl p-4 bg-slate-50/40 flex flex-col justify-between">
                  <h4 className="text-sm font-semibold text-slate-700 mb-2">สัดส่วนประเภทขยะ</h4>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(v) => `${v} กก.`} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t">
                    {pieData.map((d, i) => <div key={i} className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} /> <span className="text-slate-600 truncate">{d.name}: <b>{d.value} กก.</b></span></div>)}
                  </div>
                </div>
              </>
            ) : <p className="col-span-3 text-center py-10 text-slate-400">ไม่มีข้อมูลแสดงผลแผนภูมิ</p>}
          </div>
        )}
      </div>

      {/* บันทึกขยะ Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white">
          <DialogHeader><DialogTitle>{editingId ? "แก้ไขรายการบันทึกขยะ" : "บันทึกข้อมูลขยะประจำวัน"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>ประเภทขยะ</Label>
              <Select value={wasteType} onValueChange={setWasteType}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-white">{Object.entries(typesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>น้ำหนัก (กิโลกรัม)</Label><Input type="number" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.00" className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>ชื่อผู้จัดเก็บ/เจ้าหน้าที่</Label><Input value={collector} onChange={(e) => setCollector(e.target.value)} placeholder="ระบุชื่อ" className="h-11 rounded-xl" /></div>
            <div className="space-y-2"><Label>หมายเหตุ</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" className="h-11 rounded-xl" /></div>
            <Button className="w-full h-11 rounded-xl bg-[#0097a7] text-slate-900" onClick={() => createLog.mutate()} disabled={createLog.isPending || !weight}>{createLog.isPending ? "กำลังบันทึก..." : "ยืนยันบันทึกข้อมูล"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ตั้งค่าประเภท Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white">
          <DialogHeader><DialogTitle>ตั้งค่าประเภทขยะในระบบ</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {Object.entries(typesMap).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center border-b pb-2"><span className="text-sm font-medium">{v.label} (คีย์: {k})</span><div className="w-4 h-4 rounded-full" style={{ backgroundColor: v.chartColor }} /></div>
            ))}
            <div className="space-y-2 border-t pt-2">
              <Label className="text-xs text-slate-500">เพิ่มประเภทแบบกำหนดเอง</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="คีย์ (เช่น organic)" value={newTypeKey} onChange={(e) => setNewTypeKey(e.target.value)} className="h-10 rounded-xl" />
                <Input placeholder="ชื่อป้าย (เช่น ขยะเปียก)" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <Button size="sm" variant="outline" className="w-full rounded-xl" onClick={() => {
                const tk = newTypeKey.trim(); const tl = newTypeLabel.trim();
                if (!tk || !tl) return;
                setTypesMap(prev => ({ ...prev, [tk]: { label: tl, color: "bg-slate-100 text-slate-700 border-slate-200", chartColor: "#64748b" } }));
                setNewTypeKey(""); setNewTypeLabel("");
              }}>เพิ่มเข้าชั่วคราว</Button>
            </div>
            <Button className="w-full h-11 rounded-xl bg-slate-900 text-white" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>บันทึกการตั้งค่าลงฐานข้อมูล</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
