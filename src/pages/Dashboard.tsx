import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, PieChart, Pie, Cell, RadialBarChart, RadialBar, AreaChart, Area, Legend } from "recharts";
import { format, startOfDay, startOfWeek, startOfMonth, subDays } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportMultiSheet } from "@/lib/exportExcel";
import { toast } from "sonner";
import PageHeader from "@/components/PageHeader";
import { Wrench, CheckCircle, Flame, Trash2, Search, FlaskConical, AlertTriangle, Clock, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";

type WasteFilter = "day" | "week" | "month" | "custom";

const CHART_COLORS = ["#0097a7", "#26a69a", "#42a5f5", "#ef5350", "#ffa726", "#ab47bc", "#66bb6a", "#ec407a"];

function KpiCard({ label, value, sub, icon: Icon, trend, trendLabel, onClick, index = 0, accent = "sky" }: {
  label: string; value: string | number; sub?: string; icon?: any; trend?: "up" | "down" | "neutral";
  trendLabel?: string; onClick?: () => void; index?: number; accent?: string;
}) {
  const accentMap: Record<string, string> = {
    sky: "border-t-sky-500 text-sky-600",
    teal: "border-t-teal-500 text-teal-600",
    red: "border-t-red-500 text-red-600",
    rose: "border-t-rose-500 text-rose-600",
    cyan: "border-t-cyan-500 text-cyan-600",
    amber: "border-t-amber-500 text-amber-600",
    purple: "border-t-purple-500 text-purple-600",
    emerald: "border-t-emerald-500 text-emerald-600",
  };
  const colors = accentMap[accent] || accentMap.sky;
  const [borderClass, textClass] = colors.split(" ");

  return (
    <Card
      className={`bg-white border-t-4 ${borderClass} shadow-card hover:shadow-elevated rounded-2xl transition-all duration-300 animate-slide-up ${onClick ? "cursor-pointer hover:-translate-y-1 active:scale-[0.97]" : ""}`}
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className={`text-3xl font-extrabold mt-1 ${textClass}`}>{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
            {trend && trendLabel && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-muted-foreground"}`}>
                {trend === "up" ? <TrendingUp className="h-3 w-3" /> : trend === "down" ? <TrendingDown className="h-3 w-3" /> : null}
                {trendLabel}
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            {Icon && <Icon className={`h-6 w-6 ${textClass} opacity-40`} />}
            {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  useAuth();
  const navigate = useNavigate();

  const [wasteFilter, setWasteFilter] = useState<WasteFilter>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [drilldown, setDrilldown] = useState<string | null>(null);

  const wasteRange = useMemo(() => {
    const now = new Date();
    if (wasteFilter === "day") return { from: startOfDay(now).toISOString(), to: now.toISOString() };
    if (wasteFilter === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(), to: now.toISOString() };
    if (wasteFilter === "month") return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
    if (wasteFilter === "custom" && customFrom && customTo) {
      return { from: startOfDay(customFrom).toISOString(), to: new Date(startOfDay(customTo).getTime() + 86400000 - 1).toISOString() };
    }
    return { from: subDays(now, 30).toISOString(), to: now.toISOString() };
  }, [wasteFilter, customFrom, customTo]);

  const { data: repairStats } = useQuery({
    queryKey: ["repair-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("repair_tickets").select("status, priority, created_at, accepted_at, completed_at, equipment(department_id, departments(name), equipment_categories(name))");
      if (!data || data.length === 0) return { total: 0, byStatus: {}, avgDays: 0, topDept: "-", byCategory: [], byDept: [], statusPie: [], pending: 0, completed: 0 };
      const byStatus: Record<string, number> = { pending: 0, accepted: 0, in_progress: 0, completed: 0 };
      const deptCount: Record<string, number> = {};
      const catTimes: Record<string, number[]> = {};
      let totalDays = 0; let completedCount = 0;
      data.forEach((t: any) => {
        byStatus[t.status] = (byStatus[t.status] || 0) + 1;
        const deptName = t.equipment?.departments?.name || "ไม่ระบุ";
        deptCount[deptName] = (deptCount[deptName] || 0) + 1;
        const catName = t.equipment?.equipment_categories?.name || "ไม่ระบุ";
        if (t.status === "completed" && t.created_at && t.completed_at) {
          const days = (new Date(t.completed_at).getTime() - new Date(t.created_at).getTime()) / (1000 * 60 * 60 * 24);
          totalDays += days; completedCount++;
          if (!catTimes[catName]) catTimes[catName] = [];
          catTimes[catName].push(days);
        }
      });
      const topDept = Object.entries(deptCount).sort((a, b) => b[1] - a[1])[0];
      const byCategory = Object.entries(catTimes).map(([name, times]) => ({ name: name.length > 12 ? name.substring(0, 12) + "..." : name, avgDays: Number((times.reduce((a, b) => a + b, 0) / times.length).toFixed(1)) }));
      const byDept = Object.entries(deptCount).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 12 ? name.substring(0, 12) + "..." : name, count }));
      const statusPie = [
        { name: "รอรับงาน", value: byStatus.pending, fill: "#ffa726" },
        { name: "รับงานแล้ว", value: byStatus.accepted, fill: "#ab47bc" },
        { name: "กำลังซ่อม", value: byStatus.in_progress, fill: "#42a5f5" },
        { name: "เสร็จสิ้น", value: byStatus.completed, fill: "#66bb6a" },
      ].filter(s => s.value > 0);
      return { total: data.length, byStatus, avgDays: completedCount > 0 ? Number((totalDays / completedCount).toFixed(1)) : 0, topDept: topDept ? `${topDept[0]} (${topDept[1]})` : "-", byCategory, byDept, statusPie, pending: byStatus.pending, completed: byStatus.completed };
    },
  });

  const { data: avgScore } = useQuery({
    queryKey: ["avg-5s-score"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_5s").select("total_score");
      if (!data || data.length === 0) return 0;
      return Math.round(data.reduce((s, r) => s + Number(r.total_score), 0) / data.length);
    },
  });

  const { data: fireChecks } = useQuery({
    queryKey: ["fire-checks-summary"],
    queryFn: async () => {
      const { data } = await supabase.from("fire_extinguisher_checks").select("pressure_ok, condition_ok").order("checked_at", { ascending: false }).limit(20);
      if (!data) return { ok: 0, total: 0, rate: 0 };
      const ok = data.filter((c) => c.pressure_ok && c.condition_ok).length;
      return { ok, total: data.length, rate: data.length > 0 ? Math.round((ok / data.length) * 100) : 0 };
    },
  });

  const { data: envRoundStats } = useQuery({
    queryKey: ["env-round-stats"],
    queryFn: async () => {
      const { data: rounds } = await supabase.from("env_rounds").select("id, status").order("created_at", { ascending: false }).limit(50);
      const { data: items } = await supabase.from("env_round_items").select("result, severity");
      return { totalRounds: rounds?.length || 0, completed: rounds?.filter((r) => r.status === "completed").length || 0, abnormal: items?.filter((i) => i.result === "abnormal").length || 0, highRisk: items?.filter((i) => i.severity === "high").length || 0 };
    },
  });

  const { data: hazmatStats } = useQuery({
    queryKey: ["hazmat-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("chemicals").select("current_stock, min_stock, expiry_date, category");
      if (!data) return { total: 0, lowStock: 0, expired: 0, byCategory: [] };
      const catMap: Record<string, number> = {};
      data.forEach((c) => { catMap[c.category] = (catMap[c.category] || 0) + 1; });
      return { total: data.length, lowStock: data.filter((c) => c.current_stock <= c.min_stock).length, expired: data.filter((c) => c.expiry_date && new Date(c.expiry_date) < new Date()).length, byCategory: Object.entries(catMap).map(([name, value]) => ({ name, value })) };
    },
  });

  const { data: auditByDept } = useQuery({
    queryKey: ["audit-by-dept"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_5s").select("department_id, total_score, departments(name)");
      if (!data || data.length === 0) return [];
      const map: Record<string, { name: string; scores: number[] }> = {};
      data.forEach((r: any) => { const name = r.departments?.name || "ไม่ระบุ"; if (!map[name]) map[name] = { name, scores: [] }; map[name].scores.push(Number(r.total_score)); });
      return Object.values(map).map((d) => ({ name: d.name.length > 10 ? d.name.substring(0, 10) + "..." : d.name, score: Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) }));
    },
  });

  const { data: wasteData } = useQuery({
    queryKey: ["waste-filtered", wasteRange.from, wasteRange.to],
    queryFn: async () => {
      const { data } = await supabase.from("waste_logs").select("weight, waste_type, created_at").gte("created_at", wasteRange.from).lte("created_at", wasteRange.to).order("created_at", { ascending: true });
      if (!data || data.length === 0) return { byType: [], byDay: [], total: 0, allTypes: [] };
      const typeMap: Record<string, number> = {}; let total = 0;
      data.forEach((r) => { const w = Number(r.weight); typeMap[r.waste_type] = (typeMap[r.waste_type] || 0) + w; total += w; });
      const byType = Object.entries(typeMap).map(([type, weight]) => ({ type, weight: Number(weight.toFixed(2)) }));
      const dayMap: Record<string, Record<string, number>> = {};
      data.forEach((r) => { const day = format(new Date(r.created_at), "d MMM", { locale: th }); if (!dayMap[day]) dayMap[day] = {}; dayMap[day][r.waste_type] = (dayMap[day][r.waste_type] || 0) + Number(r.weight); });
      const allTypes = Object.keys(typeMap);
      const byDay = Object.entries(dayMap).map(([date, types]) => { const row: any = { date }; allTypes.forEach(t => { row[t] = Number((types[t] || 0).toFixed(2)); }); return row; });
      return { byType, byDay, total: Number(total.toFixed(2)), allTypes };
    },
  });

  const filterLabel = {
    day: "วันนี้", week: "สัปดาห์นี้", month: "เดือนนี้",
    custom: customFrom && customTo ? `${format(customFrom, "d MMM yy", { locale: th })} - ${format(customTo, "d MMM yy", { locale: th })}` : "เลือกช่วงวันที่",
  };

  const completionRate = repairStats && repairStats.total > 0 ? Math.round((repairStats.completed / repairStats.total) * 100) : 0;

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="Executive Dashboard" subtitle="ภาพรวม KPI สำหรับผู้บริหาร">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1.5" onClick={() => {
          const sheets = [];
          if (repairStats && repairStats.total > 0) sheets.push({ name: "สถิติงานซ่อม", data: [{ "รายการ": "รอรับงาน", "จำนวน": repairStats.byStatus.pending || 0 }, { "รายการ": "รับงานแล้ว", "จำนวน": repairStats.byStatus.accepted || 0 }, { "รายการ": "กำลังซ่อม", "จำนวน": repairStats.byStatus.in_progress || 0 }, { "รายการ": "เสร็จสิ้น", "จำนวน": repairStats.byStatus.completed || 0 }] });
          if (auditByDept && auditByDept.length > 0) sheets.push({ name: "คะแนน5ส", data: auditByDept.map(d => ({ "แผนก": d.name, "คะแนนเฉลี่ย": d.score })) });
          if (wasteData && wasteData.byType.length > 0) sheets.push({ name: "ขยะ", data: wasteData.byType.map(t => ({ "ประเภท": t.type, "น้ำหนัก (กก.)": t.weight })) });
          if (sheets.length > 0) { exportMultiSheet(sheets, "dashboard-report"); toast.success("ส่งออก Excel สำเร็จ"); }
          else toast.error("ไม่มีข้อมูลสำหรับส่งออก");
        }}>ส่งออก Excel</Button>
      </PageHeader>

      {/* Row 1: Primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard index={0} label="งานซ่อมทั้งหมด" value={repairStats?.total ?? 0} sub={`รอดำเนินการ ${repairStats?.pending ?? 0}`} icon={Wrench} accent="sky" onClick={() => setDrilldown("repair")} trend={repairStats && repairStats.pending > 5 ? "down" : "up"} trendLabel={`อัตราสำเร็จ ${completionRate}%`} />
        <KpiCard index={1} label="คะแนน 5ส เฉลี่ย" value={avgScore ? `${avgScore}%` : "-"} sub="คะแนนรวมทุกแผนก" icon={CheckCircle} accent="teal" onClick={() => setDrilldown("5s")} trend={avgScore && avgScore >= 70 ? "up" : "down"} trendLabel={avgScore && avgScore >= 70 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์"} />
        <KpiCard index={2} label="ถังดับเพลิง" value={fireChecks ? `${fireChecks.rate}%` : "-"} sub={`ปกติ ${fireChecks?.ok ?? 0}/${fireChecks?.total ?? 0}`} icon={Flame} accent="red" onClick={() => navigate("/fire-check")} trend={fireChecks && fireChecks.rate >= 80 ? "up" : "down"} trendLabel={fireChecks && fireChecks.rate >= 80 ? "สภาพดี" : "ต้องตรวจสอบ"} />
        <KpiCard index={3} label="น้ำหนักขยะ" value={wasteData ? `${wasteData.total}` : "-"} sub={`กก. (${filterLabel[wasteFilter]})`} icon={Trash2} accent="rose" onClick={() => setDrilldown("waste")} />
      </div>

      {/* Row 2: Secondary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard index={4} label="ENV Round" value={envRoundStats?.totalRounds ?? 0} sub={`เสร็จสิ้น ${envRoundStats?.completed ?? 0}`} icon={Search} accent="cyan" onClick={() => navigate("/env-round")} trend="neutral" trendLabel={`พบปัญหา ${envRoundStats?.abnormal ?? 0} จุด`} />
        <KpiCard index={5} label="สารเคมีคลัง" value={hazmatStats?.total ?? 0} sub={`สต็อกต่ำ ${hazmatStats?.lowStock ?? 0}`} icon={FlaskConical} accent="amber" onClick={() => navigate("/hazmat")} trend={hazmatStats && hazmatStats.lowStock > 0 ? "down" : "up"} trendLabel={hazmatStats && hazmatStats.lowStock > 0 ? "มีรายการสต็อกต่ำ" : "สต็อกเพียงพอ"} />
        <KpiCard index={6} label="Risk สูง (ENV)" value={envRoundStats?.highRisk ?? 0} sub="จุดเสี่ยงสูง" icon={AlertTriangle} accent="red" onClick={() => navigate("/env-round")} trend={envRoundStats && envRoundStats.highRisk > 0 ? "down" : "up"} trendLabel={envRoundStats && envRoundStats.highRisk > 0 ? "ต้องแก้ไขด่วน" : "ไม่มีจุดเสี่ยง"} />
        <KpiCard index={7} label="สารเคมีหมดอายุ" value={hazmatStats?.expired ?? 0} sub="รายการ" icon={Clock} accent="purple" onClick={() => navigate("/hazmat")} trend={hazmatStats && hazmatStats.expired > 0 ? "down" : "up"} trendLabel={hazmatStats && hazmatStats.expired > 0 ? "ต้องจัดการ" : "ปลอดภัย"} />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 5S Radial */}
        {avgScore ? (
          <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">คะแนน 5ส เฉลี่ย</h3>
                <Button size="sm" variant="ghost" className="text-xs text-sky-600 hover:bg-sky-50 rounded-xl" onClick={() => setDrilldown("5s")}>ดูรายละเอียด</Button>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={[{ name: "5ส", value: avgScore, fill: "#0097a7" }]} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={12} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#0097a7">{avgScore}%</text>
                </RadialBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null}

        {/* Repair Donut */}
        {repairStats && repairStats.statusPie.length > 0 && (
          <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '350ms', animationFillMode: 'both' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-800">สถานะงานซ่อม</h3>
                <Button size="sm" variant="ghost" className="text-xs text-sky-600 hover:bg-sky-50 rounded-xl" onClick={() => setDrilldown("repair")}>ดูรายละเอียด</Button>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={repairStats.statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                    {repairStats.statusPie.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} รายการ`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm text-slate-600 font-medium">{value}</span>} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 5S by Department */}
      {auditByDept && auditByDept.length > 0 && (
        <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">คะแนน 5ส รายแผนก</h3>
              <Button size="sm" variant="ghost" className="text-xs text-sky-600 hover:bg-sky-50 rounded-xl" onClick={() => navigate("/5s")}>ดูทั้งหมด</Button>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={auditByDept}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0097a7" stopOpacity={1} />
                    <stop offset="100%" stopColor="#0097a7" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 12, fill: '#475569' }} domain={[0, 100]} />
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="score" fill="url(#barGrad)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Repair Detail */}
      {repairStats && repairStats.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {repairStats.byDept.length > 0 && (
            <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '450ms', animationFillMode: 'both' }}>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">จำนวนแจ้งซ่อมตามแผนก</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={repairStats.byDept}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip formatter={(v: number) => `${v} รายการ`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="count" fill="#42a5f5" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
            <CardContent className="p-6 space-y-4">
              <h3 className="text-lg font-bold text-slate-800">สรุปซ่อมบำรุง</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
                  <p className="text-2xl font-bold text-sky-600">{repairStats.avgDays}</p>
                  <p className="text-xs text-sky-600 mt-1 font-medium">เวลาซ่อมเฉลี่ย (วัน)</p>
                </div>
                <div className="rounded-2xl bg-sky-50 border border-sky-100 p-4 text-center">
                  <p className="text-sm font-bold text-sky-600 truncate">{repairStats.topDept}</p>
                  <p className="text-xs text-sky-600 mt-1 font-medium">แผนกแจ้งบ่อยสุด</p>
                </div>
              </div>
              {repairStats.byCategory.length > 0 && (
                <>
                  <h4 className="text-sm font-semibold text-slate-600">เวลาซ่อมเฉลี่ยตามประเภท</h4>
                  <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={repairStats.byCategory} layout="vertical">
                      <XAxis type="number" tick={{ fontSize: 12, fill: '#475569' }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#475569' }} width={100} />
                      <Tooltip formatter={(v: number) => `${v} วัน`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="avgDays" fill="#ab47bc" radius={[0, 8, 8, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Waste Section */}
      <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up" style={{ animationDelay: '550ms', animationFillMode: 'both' }}>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">น้ำหนักขยะ</h3>
            <Badge variant="secondary" className="rounded-full bg-sky-50 text-sky-700 border-sky-200">{filterLabel[wasteFilter]}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as WasteFilter[]).map((f) => (
              <Button key={f} size="sm" variant={wasteFilter === f ? "default" : "outline"} onClick={() => setWasteFilter(f)} className={cn("text-sm h-9 rounded-2xl", wasteFilter === f ? "bg-[#0097a7] text-foreground hover:bg-[#00838f]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>
                {f === "day" ? "รายวัน" : f === "week" ? "รายสัปดาห์" : "รายเดือน"}
              </Button>
            ))}
            <Button size="sm" variant={wasteFilter === "custom" ? "default" : "outline"} onClick={() => setWasteFilter("custom")} className={cn("text-sm h-9 rounded-2xl", wasteFilter === "custom" ? "bg-[#0097a7] text-foreground hover:bg-[#00838f]" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>เลือกช่วง</Button>
          </div>

          {wasteFilter === "custom" && (
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs h-9 w-36 justify-start rounded-2xl border-slate-200", !customFrom && "text-muted-foreground")}>
                    {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(date) => date > new Date()} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs h-9 w-36 justify-start rounded-2xl border-slate-200", !customTo && "text-muted-foreground")}>
                    {customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(date) => date > new Date() || (customFrom ? date < customFrom : false)} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {wasteData && wasteData.byType.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold text-slate-600 mb-3">สัดส่วนขยะ</h4>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={wasteData.byType} dataKey="weight" nameKey="type" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={4}>
                      {wasteData.byType.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} กก.`} contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                    <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-xs text-slate-600">{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {wasteData.byDay.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-600 mb-3">แนวโน้มรายวัน</h4>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={wasteData.byDay}>
                      <defs>
                        {wasteData.allTypes.map((type: string, i: number) => (
                          <linearGradient key={type} id={`wasteGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.4} />
                            <stop offset="95%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.05} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      {wasteData.allTypes.map((type: string, i: number) => (
                        <Area key={type} type="monotone" dataKey={type} stackId="waste" fill={`url(#wasteGrad${i})`} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-6">ไม่มีข้อมูลขยะในช่วงเวลาที่เลือก</p>
          )}
        </CardContent>
      </Card>

      {(!auditByDept || auditByDept.length === 0) && (!wasteData || wasteData.byType.length === 0) && (!repairStats || repairStats.total === 0) && (
        <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up">
          <CardContent className="flex flex-col items-center gap-3 py-14">
            <p className="text-base text-muted-foreground">ยังไม่มีข้อมูล เริ่มบันทึกเพื่อดูสถิติ</p>
          </CardContent>
        </Card>
      )}

      {/* Drill-down Dialogs */}
      <Dialog open={drilldown === "repair"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">รายละเอียดงานซ่อม</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                <p className="text-2xl font-bold text-amber-600">{repairStats?.byStatus?.pending ?? 0}</p>
                <p className="text-xs text-amber-600 mt-1">รอรับงาน</p>
              </div>
              <div className="bg-blue-50 rounded-2xl p-4 text-center border border-blue-100">
                <p className="text-2xl font-bold text-blue-600">{(repairStats?.byStatus?.accepted ?? 0) + (repairStats?.byStatus?.in_progress ?? 0)}</p>
                <p className="text-xs text-blue-600 mt-1">กำลังดำเนินการ</p>
              </div>
              <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                <p className="text-2xl font-bold text-emerald-600">{repairStats?.byStatus?.completed ?? 0}</p>
                <p className="text-xs text-emerald-600 mt-1">เสร็จสิ้น</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100">
              <p className="text-sm text-slate-600">เวลาซ่อมเฉลี่ย: <span className="font-bold text-slate-800">{repairStats?.avgDays ?? 0} วัน</span></p>
              <p className="text-sm text-slate-600 mt-1">แผนกแจ้งบ่อยสุด: <span className="font-bold text-slate-800">{repairStats?.topDept ?? "-"}</span></p>
            </div>
            <Button className="w-full rounded-2xl bg-[#0097a7] text-foreground hover:bg-[#00838f]" onClick={() => { setDrilldown(null); navigate("/repair-status"); }}>ไปหน้างานซ่อม</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={drilldown === "5s"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">รายละเอียดคะแนน 5ส</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-teal-50 rounded-2xl p-4 text-center border border-teal-100">
              <p className="text-4xl font-extrabold text-teal-600">{avgScore ?? 0}%</p>
              <p className="text-sm text-teal-600 mt-1">คะแนนเฉลี่ยรวมทุกแผนก</p>
            </div>
            {auditByDept && auditByDept.length > 0 && (
              <div className="space-y-2">
                {auditByDept.map((d, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{d.name}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2">
                        <div className="bg-teal-500 h-2 rounded-full" style={{ width: `${d.score}%` }} />
                      </div>
                      <span className="text-sm font-bold text-teal-600 w-12 text-right">{d.score}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full rounded-2xl bg-[#0097a7] text-foreground hover:bg-[#00838f]" onClick={() => { setDrilldown(null); navigate("/5s"); }}>ไปหน้าตรวจ 5ส</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={drilldown === "waste"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">รายละเอียดขยะ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-2xl p-4 text-center border border-rose-100">
              <p className="text-4xl font-extrabold text-rose-600">{wasteData?.total ?? 0} กก.</p>
              <p className="text-sm text-rose-600 mt-1">น้ำหนักขยะรวม ({filterLabel[wasteFilter]})</p>
            </div>
            {wasteData && wasteData.byType.length > 0 && (
              <div className="space-y-2">
                {wasteData.byType.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <span className="text-sm font-medium text-slate-700">{t.type}</span>
                    <span className="text-sm font-bold text-slate-800">{t.weight} กก.</span>
                  </div>
                ))}
              </div>
            )}
            <Button className="w-full rounded-2xl bg-[#0097a7] text-foreground hover:bg-[#00838f]" onClick={() => { setDrilldown(null); navigate("/waste"); }}>ไปหน้าจัดการขยะ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
