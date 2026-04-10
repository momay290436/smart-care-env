import { useState, useMemo } from "react";
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

const wasteTypes: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "hsl(210 15% 55%)" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "hsl(0 72% 55%)" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "hsl(152 55% 42%)" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "hsl(45 90% 50%)" },
};

const PIE_COLORS = ["hsl(210 15% 55%)", "hsl(0 72% 55%)", "hsl(152 55% 42%)", "hsl(45 90% 50%)"];

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
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

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

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

  const createLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const w = parseFloat(weight);
      const { error } = await supabase.from("waste_logs").insert({
        waste_type: wasteType,
        weight: w,
        department_id: selectedDept || profile?.department_id || null,
        recorded_by: user.id,
      });
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
    const dayMap: Record<string, Record<string, number>> = {};
    const typeMap: Record<string, number> = {};
    const deptMap: Record<string, Record<string, number>> = {};

    filteredLogs.forEach((log: any) => {
      const day = format(new Date(log.created_at), "d MMM", { locale: th });
      const wt = wasteTypes[log.waste_type]?.label || log.waste_type;
      const dept = log.departments?.name || "ไม่ระบุ";
      const w = Number(log.weight);

      if (!dayMap[day]) dayMap[day] = {};
      dayMap[day][wt] = (dayMap[day][wt] || 0) + w;

      typeMap[wt] = (typeMap[wt] || 0) + w;

      if (!deptMap[dept]) deptMap[dept] = {};
      deptMap[dept][wt] = (deptMap[dept][wt] || 0) + w;
    });

    const lineData = Object.entries(dayMap).map(([date, types]) => ({ date, ...types }));
    const pieData = Object.entries(typeMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
    const deptData = Object.entries(deptMap).map(([dept, types]) => ({
      dept,
      ...types,
      total: Object.values(types).reduce((a, b) => a + b, 0),
    }));
    const totalWeight = filteredLogs.reduce((s: number, l: any) => s + Number(l.weight), 0);

    return { lineData, pieData, deptData, totalWeight: Math.round(totalWeight * 100) / 100 };
  }, [filteredLogs]);

  // Cost calculation
  const totalCost = useMemo(() => {
    let cost = 0;
    filteredLogs.forEach((log: any) => {
      const rate = costPerKg[log.waste_type] || 0;
      cost += Number(log.weight) * rate;
    });
    return Math.round(cost * 100) / 100;
  }, [filteredLogs, costPerKg]);

  

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูลขยะ" subtitle="บันทึก วิเคราะห์ และคำนวณต้นทุน" gradient="from-primary/10 to-accent/40">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 border-white/30 text-white hover:bg-white/10" onClick={() => {
          exportToExcel(filteredLogs.map((l: any) => ({
            "วันที่": new Date(l.created_at).toLocaleDateString("th-TH"),
            "ประเภทขยะ": wasteTypes[l.waste_type]?.label || l.waste_type,
            "น้ำหนัก (กก.)": l.weight,
            "แผนก": l.departments?.name || "-",
          })), "waste-logs", "บันทึกขยะ");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>Excel</Button>
        <Button size="sm" className="rounded-2xl h-9 bg-white/20 hover:bg-white/30 text-white border-0" onClick={() => setShowForm(!showForm)}>
          {showForm ? "ซ่อน" : "+ บันทึกใหม่"}
        </Button>
      </PageHeader>

      {showForm && (
        <Card className="shadow-lg animate-slide-up border border-slate-200 rounded-2xl bg-white">
          <CardContent className="space-y-4 pt-5">
            <div className="space-y-2">
              <Label className="font-semibold">แผนก</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">ประเภทขยะ</Label>
              <Select value={wasteType} onValueChange={setWasteType}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(wasteTypes).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-3 h-3 rounded-full`} style={{ background: v.chartColor }} />
                        <span>{v.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">น้ำหนัก (กก.)</Label>
              <Input type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" className="text-lg h-12 rounded-2xl" />
            </div>
            <Button className="w-full h-12 text-base rounded-2xl font-bold" onClick={() => createLog.mutate()} disabled={createLog.isPending || !weight}>
              {createLog.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-3 h-12 rounded-2xl bg-muted/60">
          <TabsTrigger value="dashboard" className="rounded-xl text-base font-semibold">แดชบอร์ด</TabsTrigger>
          <TabsTrigger value="records" className="rounded-xl text-base font-semibold">รายการ</TabsTrigger>
          <TabsTrigger value="cost" className="rounded-xl text-base font-semibold">ต้นทุน</TabsTrigger>
        </TabsList>

        <Card className="shadow-lg mt-4 border border-slate-200 rounded-2xl bg-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 text-sm w-32 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {Object.entries(wasteTypes).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
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
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl", !customFrom && "text-slate-500")}>
                      {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl", !customTo && "text-slate-500")}>
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
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="shadow-card border border-border/50 rounded-2xl card-ocean">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-primary">{chartData.totalWeight}</p>
                <p className="text-xs text-muted-foreground mt-1">น้ำหนักรวม (กก.)</p>
              </CardContent>
            </Card>
            {Object.entries(wasteTypes).map(([k, v]) => {
              const typeWeight = filteredLogs.filter((l: any) => l.waste_type === k).reduce((s: number, l: any) => s + Number(l.weight), 0);
              return (
                <Card key={k} className={`shadow-card border border-border/50 rounded-2xl ${v.color}`}>
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{Math.round(typeWeight * 100) / 100}</p>
                    <p className="text-xs mt-1">{v.label} (กก.)</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {chartData.lineData.length > 0 && (
            <Card className="shadow-card border border-border/50 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">แนวโน้มขยะรายวัน</h3>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={chartData.lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 90%)" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    {Object.values(wasteTypes).map((wt) => (
                      <Line key={wt.label} type="monotone" dataKey={wt.label} stroke={wt.chartColor} strokeWidth={2.5} dot={{ r: 4 }} />
                    ))}
                  </LineChart>
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
                      {chartData.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} กก.`} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="space-y-3 mt-4">
          {filteredLogs.map((log: any) => {
            const wt = wasteTypes[log.waste_type] || wasteTypes.general;
            return (
              <Card key={log.id} className="shadow-card border border-border/50 rounded-2xl animate-fade-in cursor-pointer hover:shadow-elevated transition-all" onClick={() => setSelectedLog(log)}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div>
                      <Badge className={`${wt.color} border rounded-xl`} variant="secondary">{wt.label}</Badge>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(log.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                        {" · "}{log.departments?.name || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-bold text-foreground">{log.weight} <span className="text-xs font-normal text-muted-foreground">กก.</span></p>
                    {isAdmin && (
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive rounded-xl" onClick={(e) => { e.stopPropagation(); if (confirm("ยืนยันลบ?")) deleteLog.mutate(log.id); }}>
                        ✕
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredLogs.length === 0 && (
            <Card className="shadow-card border border-border/50 rounded-2xl">
              <CardContent className="flex flex-col items-center gap-2 py-10">
                <p className="text-base text-muted-foreground">ไม่มีบันทึกขยะในช่วงที่เลือก</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cost" className="space-y-4 mt-4">
          <Card className="shadow-card border border-border/50 rounded-2xl card-ocean">
            <CardContent className="p-5 text-center">
              <p className="text-base text-muted-foreground mb-1">ค่าใช้จ่ายกำจัดขยะ (ประมาณ)</p>
              <p className="text-3xl font-bold text-primary">{totalCost.toLocaleString()} <span className="text-base font-normal text-muted-foreground">บาท</span></p>
              <p className="text-xs text-muted-foreground mt-1">จากขยะ {chartData.totalWeight} กก.</p>
            </CardContent>
          </Card>

          {/* Cost breakdown bar chart */}
          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">กราฟค่าใช้จ่ายตามประเภทขยะ</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={Object.entries(wasteTypes).map(([k, v]) => {
                  const typeWeight = filteredLogs.filter((l: any) => l.waste_type === k).reduce((s: number, l: any) => s + Number(l.weight), 0);
                  return { name: v.label, weight: Math.round(typeWeight * 100) / 100, cost: Math.round(typeWeight * (costPerKg[k] || 0) * 100) / 100, fill: v.chartColor };
                })} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}฿`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(v: number, name: string) => name === "cost" ? [`${v} ฿`, "ค่าใช้จ่าย"] : [`${v} กก.`, "น้ำหนัก"]} />
                  <Bar dataKey="cost" radius={[0, 8, 8, 0]}>
                    {Object.values(wasteTypes).map((v, i) => <Cell key={i} fill={v.chartColor} />)}
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
                    Object.entries(wasteTypes).forEach(([, v]) => {
                      const w = (d as any)[v.label] || 0;
                      const k = Object.entries(wasteTypes).find(([, vv]) => vv.label === v.label)?.[0] || "general";
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
              {Object.entries(wasteTypes).map(([k, v]) => (
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

          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">รายละเอียดค่าใช้จ่าย</h3>
              <div className="space-y-2">
                {Object.entries(wasteTypes).map(([k, v]) => {
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
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>รายละเอียดบันทึกขยะ</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-base">
                  <div className="flex justify-between"><span className="text-muted-foreground">ประเภท:</span><Badge className={`${wasteTypes[selectedLog.waste_type]?.color} border`} variant="secondary">{wasteTypes[selectedLog.waste_type]?.label}</Badge></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">น้ำหนัก:</span><span className="font-bold text-foreground">{selectedLog.weight} กก.</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">แผนก:</span><span className="text-foreground">{selectedLog.departments?.name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">วันที่:</span><span className="text-foreground">{new Date(selectedLog.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
