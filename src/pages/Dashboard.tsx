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
import { Wrench, CheckCircle, Flame, Trash2, Search, FlaskConical, AlertTriangle } from "lucide-react";

type WasteFilter = "day" | "week" | "month" | "custom";

const CHART_COLORS = ["#0097a7", "#26a69a", "#42a5f5", "#ef5350", "#ffa726", "#ab47bc", "#66bb6a", "#ec407a"];

const WASTE_FORECAST_COST_PER_KG: Record<string, number> = {
  general: 2,
  infectious: 15,
  recycle: 1,
  hazardous: 25,
  organic: 3,
  other: 10,
};

function addMonths(date: Date, months: number) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function MetricPanel({ label, value, sub, note, icon: Icon, onClick, accent = "sky" }: {
  label: string; value: string | number; sub?: string; note?: string; icon?: any; onClick?: () => void; accent?: string;
}) {
  const accentMap: Record<string, { iconBg: string; iconColor: string; text: string }> = {
    sky: { iconBg: "bg-blue-500", iconColor: "text-white", text: "text-slate-700" },
    teal: { iconBg: "bg-teal-500", iconColor: "text-white", text: "text-slate-700" },
    red: { iconBg: "bg-red-500", iconColor: "text-white", text: "text-slate-700" },
    rose: { iconBg: "bg-rose-500", iconColor: "text-white", text: "text-slate-700" },
    cyan: { iconBg: "bg-cyan-500", iconColor: "text-white", text: "text-slate-700" },
    amber: { iconBg: "bg-amber-500", iconColor: "text-white", text: "text-slate-700" },
    purple: { iconBg: "bg-purple-500", iconColor: "text-white", text: "text-slate-700" },
    emerald: { iconBg: "bg-emerald-500", iconColor: "text-white", text: "text-slate-700" },
    green: { iconBg: "bg-green-500", iconColor: "text-white", text: "text-slate-700" },
  };
  const colors = accentMap[accent] || accentMap.sky;

  return (
    <div
      className={`bg-white rounded-xl p-6 transition hover:shadow-lg border border-slate-100 ${onClick ? "cursor-pointer" : ""}`}
      onClick={onClick}
    >
      <div className="flex flex-col gap-4">
        {Icon && (
          <div className={`w-14 h-14 rounded-xl ${colors.iconBg} flex items-center justify-center`}>
            <Icon className={`h-7 w-7 ${colors.iconColor}`} />
          </div>
        )}
        <div>
          <h3 className="text-base font-bold text-slate-800">{label}</h3>
          <p className="text-sm text-slate-600 mt-2">{sub}</p>
          {note && <p className="text-xs text-slate-500 mt-1">{note}</p>}
        </div>
        <div className="mt-auto pt-2">
          <p className="text-xs text-teal-500 font-medium">เพิ่มเติม →</p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  useAuth();
  const navigate = useNavigate();

  const [wasteFilter, setWasteFilter] = useState<WasteFilter>("month");
  const [customFrom, setCustomFrom] = useState<Date | undefined>(undefined);
  const [customTo, setCustomTo] = useState<Date | undefined>(undefined);
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const [forecastType, setForecastType] = useState<string>("general");
  const [forecastHorizon, setForecastHorizon] = useState<3 | 6 | 12>(3);

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

  const { data: wasteHistory } = useQuery({
    queryKey: ["waste-history"],
    queryFn: async () => {
      // Fetch new waste logs
      const { data: wasteLogsData } = await supabase.from("waste_logs").select("waste_type, weight, created_at").order("created_at", { ascending: true }).limit(1000);
      
      // Fetch old infectious waste records
      const { data: infWasteData } = await supabase.from("infectious_waste_records").select("sharp_waste_kg, non_sharp_waste_kg, collection_date").order("collection_date", { ascending: true }).limit(1000);
      
      // Combine data: convert infectious_waste_records to waste_logs format
      const combinedData: any[] = wasteLogsData || [];
      if (infWasteData && infWasteData.length > 0) {
        const infWasteFormatted = infWasteData.map((r: any) => ({
          waste_type: "infectious",
          weight: Number((Number(r.sharp_waste_kg || 0) + Number(r.non_sharp_waste_kg || 0)).toFixed(2)),
          created_at: r.collection_date
        }));
        combinedData.push(...infWasteFormatted);
      }
      
      // Sort by created_at
      return combinedData.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    },
  });

  const { data: waterStats } = useQuery({
    queryKey: ["water-kpi"],
    queryFn: async () => {
      const [meterResponse, qualityResponse] = await Promise.all([
        supabase.from("water_meter_records").select("record_date, usage_amount").order("record_date", { ascending: true }).limit(500),
        supabase.from("water_quality_logs").select("status, check_date").order("check_date", { ascending: false }).limit(200),
      ]);
      return {
        meterRecords: meterResponse.data || [],
        qualityLogs: qualityResponse.data || [],
      };
    },
  });

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
      const { data } = await supabase.from("fire_extinguisher_checks").select("location, pressure_ok, condition_ok, checked_at").order("checked_at", { ascending: false });
      if (!data || data.length === 0) return { ok: 0, total: 0, rate: 0 };
      
      // Get the latest check for each location
      const latestByLocation: Record<string, any> = {};
      data.forEach((c) => {
        if (!latestByLocation[c.location]) {
          latestByLocation[c.location] = c;
        }
      });
      
      const checks = Object.values(latestByLocation);
      const ok = checks.filter((c: any) => c.pressure_ok && c.condition_ok).length;
      return { ok, total: checks.length, rate: checks.length > 0 ? Math.round((ok / checks.length) * 100) : 0 };
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

  const { data: issueStats } = useQuery({
    queryKey: ["issue-stats"],
    queryFn: async () => {
      const { data } = await supabase.from("issues").select("status").order("created_at", { ascending: false }).limit(500);
      if (!data) return { pending: 0, in_progress: 0, resolved: 0 };
      return {
        pending: data.filter((i) => i.status === "pending").length,
        in_progress: data.filter((i) => i.status === "in_progress").length,
        resolved: data.filter((i) => i.status === "resolved").length,
      };
    },
  });

  const { data: wasteData } = useQuery({
    queryKey: ["waste-filtered", wasteRange.from, wasteRange.to],
    queryFn: async () => {
      // Fetch new waste logs within date range
      const { data: wasteLogsData } = await supabase.from("waste_logs").select("weight, waste_type, created_at").gte("created_at", wasteRange.from).lte("created_at", wasteRange.to).order("created_at", { ascending: true });
      
      // Fetch old infectious waste records within date range
      const fromDate = wasteRange.from.split('T')[0];
      const toDate = wasteRange.to.split('T')[0];
      const { data: infWasteData } = await supabase.from("infectious_waste_records").select("sharp_waste_kg, non_sharp_waste_kg, collection_date").gte("collection_date", fromDate).lte("collection_date", toDate).order("collection_date", { ascending: true });
      
      // Combine data
      const combinedData: any[] = wasteLogsData || [];
      if (infWasteData && infWasteData.length > 0) {
        const infWasteFormatted = infWasteData.map((r: any) => ({
          weight: Number((Number(r.sharp_waste_kg || 0) + Number(r.non_sharp_waste_kg || 0)).toFixed(2)),
          waste_type: "infectious",
          created_at: r.collection_date
        }));
        combinedData.push(...infWasteFormatted);
      }
      
      if (!combinedData || combinedData.length === 0) return { byType: [], byDay: [], total: 0, allTypes: [] };
      
      const typeMap: Record<string, number> = {}; let total = 0;
      combinedData.forEach((r) => { const w = Number(r.weight); typeMap[r.waste_type] = (typeMap[r.waste_type] || 0) + w; total += w; });
      const byType = Object.entries(typeMap).map(([type, weight]) => ({ type, weight: Number(weight.toFixed(2)) }));
      const dayMap: Record<string, Record<string, number>> = {};
      combinedData.forEach((r) => { const day = format(new Date(r.created_at), "d MMM", { locale: th }); if (!dayMap[day]) dayMap[day] = {}; dayMap[day][r.waste_type] = (dayMap[day][r.waste_type] || 0) + Number(r.weight); });
      const allTypes = Object.keys(typeMap);
      const byDay = Object.entries(dayMap).map(([date, types]) => { const row: any = { date }; allTypes.forEach(t => { row[t] = Number((types[t] || 0).toFixed(2)); }); return row; });
      return { byType, byDay, total: Number(total.toFixed(2)), allTypes };
    },
  });

  const wasteTypes = useMemo(() => {
    const types = new Set<string>();
    (wasteHistory || []).forEach((r: any) => { if (r.waste_type) types.add(r.waste_type); });
    return Array.from(types);
  }, [wasteHistory]);

  const selectedForecastType = wasteTypes.includes(forecastType) ? forecastType : wasteTypes[0] || "general";

  const wasteForecast = useMemo(() => {
    const history = wasteHistory || [];
    const typeMap: Record<string, number> = {};
    history.forEach((r: any) => {
      if (r.waste_type !== selectedForecastType) return;
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      typeMap[key] = (typeMap[key] || 0) + Number(r.weight);
    });

    const months = Object.keys(typeMap).sort();
    const recent = months.slice(-12);
    const actual: Array<{ month: string; monthKey: string; actual: number; forecast?: number }> = recent.map((monthKey) => {
      const [y, m] = monthKey.split("-");
      const label = format(new Date(Number(y), Number(m) - 1, 1), "MMM yy", { locale: th });
      return { month: label, monthKey, actual: Number(typeMap[monthKey].toFixed(2)), forecast: undefined };
    });
    const changes: number[] = [];
    for (let i = 1; i < actual.length; i += 1) {
      changes.push(actual[i].actual - actual[i - 1].actual);
    }
    const avgDelta = changes.length > 0 ? changes.reduce((sum, v) => sum + v, 0) / changes.length : 0;
    let baseline = actual.length > 0 ? actual[actual.length - 1].actual : 0;
    const lastMonthKey = actual.length > 0 ? actual[actual.length - 1].monthKey : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const [lastYear, lastMonth] = lastMonthKey.split("-").map(Number);
    const lastDate = new Date(lastYear, lastMonth - 1, 1);

    const forecast: Array<{ month: string; monthKey: string; forecast: number; actual?: number }> = [];
    for (let i = 1; i <= forecastHorizon; i += 1) {
      const nextDate = addMonths(lastDate, i);
      baseline = Math.max(0, baseline + avgDelta);
      const monthKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
      forecast.push({ month: format(nextDate, "MMM yy", { locale: th }), monthKey, forecast: Number(baseline.toFixed(2)) });
    }
    const forecastTotal = forecast.reduce((sum, item) => sum + item.forecast, 0);
    const forecastCost = Number((forecastTotal * (WASTE_FORECAST_COST_PER_KG[selectedForecastType] ?? WASTE_FORECAST_COST_PER_KG.other)).toFixed(2));
    const chart = [
      ...actual.map((item) => ({ month: item.month, actual: item.actual, forecast: undefined })),
      ...forecast.map((item) => ({ month: item.month, actual: undefined, forecast: item.forecast })),
    ];

    return { chart, total: Number(forecastTotal.toFixed(2)), cost: forecastCost, type: selectedForecastType };
  }, [wasteHistory, selectedForecastType, forecastHorizon]);

  const waterKpi = useMemo(() => {
    const meters = (waterStats?.meterRecords || []) as any[];
    const quality = (waterStats?.qualityLogs || []) as any[];
    const monthlyMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    meters.forEach((r) => {
      const date = r.record_date;
      if (!date) return;
      dailyMap[date] = (dailyMap[date] || 0) + Number(r.usage_amount || 0);
      const monthKey = date.slice(0, 7);
      monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + Number(r.usage_amount || 0);
    });

    const monthly = Object.keys(monthlyMap).sort().slice(-6).map((monthKey) => {
      const [y, m] = monthKey.split("-");
      return { month: format(new Date(Number(y), Number(m) - 1, 1), "MMM yy", { locale: th }), value: Number(monthlyMap[monthKey].toFixed(0)) };
    });

    const totalDays = Object.keys(dailyMap).length;
    const totalUsage = Object.values(dailyMap).reduce((sum, value) => sum + value, 0);
    const averageUsage = totalDays > 0 ? Number((totalUsage / totalDays).toFixed(0)) : 0;
    const passCount = quality.filter((r) => r.status === "pass").length;
    const qualityTotal = quality.length;
    const qualityRate = qualityTotal > 0 ? Math.round((passCount / qualityTotal) * 100) : 0;
    const reserveVolume = averageUsage * 2;

    return { monthly, averageUsage, qualityRate, passCount, qualityTotal, reserveVolume };
  }, [waterStats]);

  const filterLabel = {
    day: "วันนี้", week: "สัปดาห์นี้", month: "เดือนนี้",
    custom: customFrom && customTo ? `${format(customFrom, "d MMM yy", { locale: th })} - ${format(customTo, "d MMM yy", { locale: th })}` : "เลือกช่วงวันที่",
  };

  const completionRate = repairStats && repairStats.total > 0 ? Math.round((repairStats.completed / repairStats.total) * 100) : 0;

  return (
    <div className="space-y-6 pb-6">
      <PageHeader title="แดชบอร์ด KPI" subtitle="ข้อมูลสำคัญสำหรับผู้บริหาร">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1.5" onClick={() => {
          const sheets = [];
          if (repairStats && repairStats.total > 0) sheets.push({ name: "สถิติงานซ่อม", data: [{ "รายการ": "รอรับงาน", "จำนวน": repairStats.byStatus.pending || 0 }, { "รายการ": "รับงานแล้ว", "จำนวน": repairStats.byStatus.accepted || 0 }, { "รายการ": "กำลังซ่อม", "จำนวน": repairStats.byStatus.in_progress || 0 }, { "รายการ": "เสร็จสิ้น", "จำนวน": repairStats.byStatus.completed || 0 }] });
          if (auditByDept && auditByDept.length > 0) sheets.push({ name: "คะแนน5ส", data: auditByDept.map(d => ({ "แผนก": d.name, "คะแนนเฉลี่ย": d.score })) });
          if (wasteData && wasteData.byType.length > 0) sheets.push({ name: "ขยะ", data: wasteData.byType.map(t => ({ "ประเภท": t.type, "น้ำหนัก (กก.)": t.weight })) });
          if (sheets.length > 0) { exportMultiSheet(sheets, "dashboard-report"); toast.success("ส่งออก Excel สำเร็จ"); }
          else toast.error("ไม่มีข้อมูลสำหรับส่งออก");
        }}>ส่งออก Excel</Button>
      </PageHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricPanel
            label="งานซ่อมทั้งหมด"
            value={repairStats?.total ?? 0}
            sub={`รอดำเนินการ ${repairStats?.pending ?? 0} | เสร็จแล้ว ${repairStats?.completed ?? 0}`}
            note={`อัตราสำเร็จ ${completionRate}%`}
            icon={Wrench}
            accent="sky"
            onClick={() => setDrilldown("repair")}
          />
          <MetricPanel
            label="คะแนน 5ส เฉลี่ย"
            value={avgScore ? `${avgScore}%` : "-"}
            sub={`${auditByDept?.length ?? 0} แผนก`}
            note={avgScore ? (avgScore >= 70 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์") : "ยังไม่มีข้อมูล"}
            icon={CheckCircle}
            accent="teal"
            onClick={() => setDrilldown("5s")}
          />
          <MetricPanel
            label="ถังดับเพลิง"
            value={fireChecks ? `${fireChecks.rate}%` : "-"}
            sub={`ปกติ ${fireChecks?.ok ?? 0}/${fireChecks?.total ?? 0}`}
            note={fireChecks ? (fireChecks.rate >= 80 ? "สภาพดี" : "ต้องตรวจสอบ") : "ไม่มีข้อมูล"}
            icon={Flame}
            accent="red"
            onClick={() => setDrilldown("fire")}
          />
          <MetricPanel
            label="น้ำหนักขยะ"
            value={wasteData ? `${wasteData.total} กก.` : "-"}
            sub={`ช่วง ${filterLabel[wasteFilter]}`}
            note={`${wasteData?.byType?.length ?? 0} ประเภทขยะ`}
            icon={Trash2}
            accent="rose"
            onClick={() => setDrilldown("waste")}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <MetricPanel
            label="ENV Round"
            value={envRoundStats?.totalRounds ?? 0}
            sub={`เสร็จสิ้น ${envRoundStats?.completed ?? 0}`}
            note={`พบปัญหา ${envRoundStats?.abnormal ?? 0} จุด`}
            icon={Search}
            accent="cyan"
            onClick={() => setDrilldown("env")}
          />
          <MetricPanel
            label="สารเคมีคลัง"
            value={hazmatStats?.total ?? 0}
            sub={`สต็อกต่ำ ${hazmatStats?.lowStock ?? 0}`}
            note={`หมดอายุ ${hazmatStats?.expired ?? 0} รายการ`}
            icon={FlaskConical}
            accent="amber"
            onClick={() => navigate("/hazmat")}
          />
          <MetricPanel
            label="ปัญหาที่ต้องจัดการ"
            value={(issueStats?.pending ?? 0) + (issueStats?.in_progress ?? 0)}
            sub={`รอ ${issueStats?.pending ?? 0} | ดำเนินการ ${issueStats?.in_progress ?? 0}`}
            note={`แก้ไขแล้ว ${issueStats?.resolved ?? 0}`}
            icon={AlertTriangle}
            accent="red"
            onClick={() => navigate("/issues")}
          />
        </div>
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
            <div className="space-y-6">
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

            <div className="mt-6 rounded-3xl border border-slate-200 p-5 bg-slate-50">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h4 className="text-sm font-semibold text-slate-700">พยากรณ์ขยะ</h4>
                  <p className="text-sm text-slate-500">เลือกประเภทขยะและช่วงพยากรณ์ 3, 6 หรือ 12 เดือน</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select value={selectedForecastType} onChange={(e) => setForecastType(e.target.value)} className="h-10 rounded-2xl border border-slate-300 bg-white px-3 text-sm text-slate-700 shadow-sm">
                    {wasteTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {([3, 6, 12] as const).map((months) => (
                    <Button key={months} size="sm" variant={forecastHorizon === months ? "default" : "outline"} className="text-xs h-10 rounded-2xl px-3" onClick={() => setForecastHorizon(months)}>
                      {months === 12 ? "รายปี" : ` ${months} เดือน`}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="mt-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">ประเภท</p>
                      <p className="mt-1 text-lg font-semibold text-slate-900">{wasteForecast.type}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">ปริมาณพยากรณ์</p>
                      <p className="mt-1 text-2xl font-bold text-slate-900">{wasteForecast.total} กก.</p>
                    </div>
                    <div className="rounded-2xl bg-white p-4 shadow-sm border border-slate-200">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-500">คาดการณ์ค่าใช้จ่าย</p>
                      <p className="mt-1 text-2xl font-bold text-emerald-600">{wasteForecast.cost} ฿</p>
                      <p className="text-xs text-slate-500 mt-1">อัตราค่าใช้จ่ายโดยประมาณ {WASTE_FORECAST_COST_PER_KG[wasteForecast.type] ?? WASTE_FORECAST_COST_PER_KG.other} ฿/กก.</p>
                    </div>
                  </div>
                  <div className="rounded-3xl bg-white p-4 shadow-sm border border-slate-200">
                    <h4 className="text-sm font-semibold text-slate-700 mb-3">แนวโน้มพยากรณ์</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={wasteForecast.chart} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="forecastActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="forecastLine" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#f97316" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                        <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                        <Area type="monotone" dataKey="actual" stroke="#22c55e" fill="url(#forecastActual)" strokeWidth={2} connectNulls />
                        <Area type="monotone" dataKey="forecast" stroke="#f97316" fill="url(#forecastLine)" strokeDasharray="4 4" strokeWidth={2} connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-6">ไม่มีข้อมูลขยะในช่วงเวลาที่เลือก</p>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white shadow-card rounded-2xl border-0 animate-slide-up">
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-800">KPI ภาพรวม</h3>
              <p className="text-sm text-slate-500">สรุปผลการทำงาน 5ส., การจัดการปัญหา และน้ำประปา สำหรับผู้บริหาร</p>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">5ส. โดยรวม</p>
                  <p className="text-xs text-slate-500">คะแนนเฉลี่ยและคะแนนตามแผนก</p>
                </div>
                <div className="rounded-full bg-teal-100 px-3 py-1 text-sm font-semibold text-teal-700">{avgScore ? `${avgScore}%` : "-"}</div>
              </div>
              <div className="mt-4 h-40">
                {auditByDept && auditByDept.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={auditByDept.slice(0, 6)} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} interval={0} angle={-35} textAnchor="end" height={50} />
                      <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Bar dataKey="score" fill="#14b8a6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-slate-500">ยังไม่มีข้อมูล 5ส.</p>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">การจัดการปัญหา</p>
                  <p className="text-xs text-slate-500">สถานะของปัญหาในระบบ</p>
                </div>
                <div className="rounded-full bg-sky-100 px-3 py-1 text-sm font-semibold text-sky-700">{(issueStats?.pending ?? 0) + (issueStats?.in_progress ?? 0)} รายการ</div>
              </div>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: 'รอดำเนินการ', value: issueStats?.pending ?? 0, fill: '#f59e0b' },
                      { name: 'กำลังดำเนินการ', value: issueStats?.in_progress ?? 0, fill: '#3b82f6' },
                      { name: 'แก้ไขแล้ว', value: issueStats?.resolved ?? 0, fill: '#4ade80' },
                    ]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={3}>
                      {[(issueStats?.pending ?? 0), (issueStats?.in_progress ?? 0), (issueStats?.resolved ?? 0)].map((_, idx) => (
                        <Cell key={idx} fill={['#f59e0b', '#3b82f6', '#4ade80'][idx]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value: number) => `${value} รายการ`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-700">น้ำประปา</p>
                  <p className="text-xs text-slate-500">แนวโน้มการใช้น้ำและคุณภาพ</p>
                </div>
                <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">{waterKpi.qualityRate ?? 0}%</div>
              </div>
              <div className="mt-4 h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={waterKpi.monthly} margin={{ top: 10, right: 0, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value: number) => `${value} ลิตร`} />
                    <Area type="monotone" dataKey="value" stroke="#10b981" fill="#a7f3d0" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600">
                <div className="rounded-2xl bg-white p-3 border border-slate-200">
                  <p className="font-semibold text-slate-900">เฉลี่ยต่อวัน</p>
                  <p>{waterKpi.averageUsage ?? 0} ลิตร</p>
                </div>
                <div className="rounded-2xl bg-white p-3 border border-slate-200">
                  <p className="font-semibold text-slate-900">น้ำสำรอง</p>
                  <p>170 ลบ.ม.</p>
                </div>
              </div>
            </div>
          </div>
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

      {/* ENV Drilldown */}
      <Dialog open={drilldown === "env"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-2xl rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">รายละเอียด ENV Round</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-cyan-50 rounded-2xl p-4 text-center border border-cyan-100">
                <p className="text-2xl font-bold text-cyan-600">{envRoundStats?.totalRounds ?? 0}</p>
                <p className="text-xs text-cyan-600 mt-1">รอบตรวจทั้งหมด</p>
              </div>
              <div className="bg-amber-50 rounded-2xl p-4 text-center border border-amber-100">
                <p className="text-2xl font-bold text-amber-600">{envRoundStats?.abnormal ?? 0}</p>
                <p className="text-xs text-amber-600 mt-1">พบปัญหา</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                <p className="text-2xl font-bold text-red-600">{envRoundStats?.highRisk ?? 0}</p>
                <p className="text-xs text-red-600 mt-1">ความเสี่ยงสูง</p>
              </div>
            </div>
            {envRoundStats && envRoundStats.highRisk > 0 && (
              <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
                <p className="text-sm font-bold text-red-700 flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> มีจุดเสี่ยงสูงที่ต้องแก้ไข</p>
                <p className="text-xs text-red-600 mt-1">กดปุ่มด้านล่างเพื่อดูรายละเอียดและจัดการปัญหา</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button className="rounded-2xl bg-[#0097a7] text-foreground hover:bg-[#00838f]" onClick={() => { setDrilldown(null); navigate("/env-round"); }}>ไปหน้า ENV Round</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => { setDrilldown(null); navigate("/issues"); }}>ดูหน้าจัดการปัญหา</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fire Extinguisher Drilldown */}
      <Dialog open={drilldown === "fire"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl text-slate-800">รายละเอียดถังดับเพลิง</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                <p className="text-3xl font-extrabold text-emerald-600">{fireChecks?.ok ?? 0}</p>
                <p className="text-xs text-emerald-600 mt-1 font-medium">ปกติ ✓</p>
              </div>
              <div className="bg-red-50 rounded-2xl p-4 text-center border border-red-100">
                <p className="text-3xl font-extrabold text-red-600">{(fireChecks?.total ?? 0) - (fireChecks?.ok ?? 0)}</p>
                <p className="text-xs text-red-600 mt-1 font-medium">ไม่ปกติ ✕</p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 text-center">
              <p className="text-sm text-slate-600">อัตราปกติ</p>
              <p className="text-4xl font-extrabold text-slate-800 mt-1">{fireChecks?.rate ?? 0}%</p>
              <p className="text-xs text-muted-foreground mt-1">จากการตรวจล่าสุด {fireChecks?.total ?? 0} รายการ</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button className="rounded-2xl bg-[#0097a7] text-foreground hover:bg-[#00838f]" onClick={() => { setDrilldown(null); navigate("/fire-check"); }}>ไปหน้าตรวจถังดับเพลิง</Button>
              <Button variant="outline" className="rounded-2xl" onClick={() => { setDrilldown(null); navigate("/issues"); }}>ดูหน้าจัดการปัญหา</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
