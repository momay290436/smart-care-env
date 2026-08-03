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

const CHART_COLORS = ["#388c0e", "#729df1", "#ef5b8d", "#673ab7", "#259b24", "#08a8cb", "#66bb6a", "#ec407a"];

// สีตามประเภทขยะ (สอดคล้องกับหน้าจัดการขยะ)
const WASTE_COLORS: Record<string, string> = {
  general: "#3b82f6",      // ขยะทั่วไป - น้ำเงิน
  organic: "#10b981",      // ขยะเปียก - เขียว
  infectious: "#ef4444",   // ขยะติดเชื้อ - แดง
  recycle: "#eab308",      // ขยะรีไซเคิล - เหลือง
  hazardous: "#a855f7",    // ขยะอันตราย - ม่วง
  other: "#94a3b8",
};
const getWasteColor = (type: string) => WASTE_COLORS[normalizeWasteType(type)] || WASTE_COLORS.other;

const WASTE_FORECAST_COST_PER_KG: Record<string, number> = {
  general: 0,
  infectious: 11,
  recycle: 0,
  hazardous: 0,
  organic: 0,
  other: 0,
};

const WASTE_TYPE_LABELS: Record<string, string> = {
  general: "ขยะทั่วไป",
  infectious: "ขยะติดเชื้อ",
  recycle: "ขยะรีไซเคิล",
  recyclable: "ขยะรีไซเคิล",
  hazardous: "ขยะอันตราย",
  organic: "ขยะเปียก",
  "organic waste": "ขยะเปียก",
  other: "อื่นๆ",
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

const getWasteTypeLabel = (type: string) => WASTE_TYPE_LABELS[normalizeWasteType(type)] || type;

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
    return { from: startOfMonth(now).toISOString(), to: now.toISOString() };
  }, [wasteFilter, customFrom, customTo]);

  const { data: wasteHistory } = useQuery({
    queryKey: ["waste-history"],
    queryFn: async () => {
      const { data: wasteLogsData } = await supabase
        .from("waste_logs")
        .select("waste_type, weight, created_at")
        .order("created_at", { ascending: true });
      const { data: infRecs } = await supabase
        .from("infectious_waste_records")
        .select("collection_date, sharp_waste_kg, non_sharp_waste_kg, created_at");

      // รวมข้อมูลขยะติดเชื้อ (สำคัญสำหรับระบบพยากรณ์รายประเภท)
      const existingInfKeys = new Set(
        (wasteLogsData || [])
          .filter((l: any) => normalizeWasteType(l.waste_type) === "infectious")
          .map((l: any) => `${(l.created_at || "").substring(0, 10)}|${Number(l.weight)}`)
      );
      const extraInf = (infRecs || [])
        .map((r: any) => {
          const w = Number(r.sharp_waste_kg || 0) + Number(r.non_sharp_waste_kg || 0);
          const day = r.collection_date || (r.created_at || "").substring(0, 10);
          if (!day || w <= 0) return null;
          const key = `${day}|${w}`;
          if (existingInfKeys.has(key)) return null;
          return { waste_type: "infectious", weight: w, created_at: `${day}T08:00:00` };
        })
        .filter(Boolean) as any[];
      return [...(wasteLogsData || []), ...extraInf];
    },
  });

  const { data: waterStats } = useQuery({
    queryKey: ["water-kpi"],
    queryFn: async () => {
      const [meterResponse, qualityResponse] = await Promise.all([
        supabase.from("water_meter_records").select("record_date, usage_amount").order("record_date", { ascending: true }).limit(500),
        supabase.from("water_quality_logs").select("status, check_date").order("check_date", { ascending: false }).limit(200),
      ]);
      return { meterRecords: meterResponse.data || [], qualityLogs: qualityResponse.data || [] };
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
      const latestByLocation: Record<string, any> = {};
      data.forEach((c) => { if (!latestByLocation[c.location]) latestByLocation[c.location] = c; });
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
      return { pending: data.filter((i) => i.status === "pending").length, in_progress: data.filter((i) => i.status === "in_progress").length, resolved: data.filter((i) => i.status === "resolved").length };
    },
  });

  const { data: wasteCostSettings } = useQuery({
    queryKey: ["waste-costs"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "waste_costs").maybeSingle();
      if (!data?.value) return {};
      try { return JSON.parse(data.value) as Record<string, number>; } catch { return {}; }
    },
  });

  const wasteRates = useMemo(() => ({ ...WASTE_FORECAST_COST_PER_KG, ...(wasteCostSettings || {}) }), [wasteCostSettings]);

  const { data: wasteData } = useQuery({
    queryKey: ["waste-filtered", wasteRange.from, wasteRange.to],
    queryFn: async () => {
      const { data: wasteLogsData } = await supabase
        .from("waste_logs")
        .select("weight, waste_type, created_at")
        .gte("created_at", wasteRange.from)
        .lte("created_at", wasteRange.to)
        .order("created_at", { ascending: true });
      
      // Merge infectious waste records not already accounted for in waste_logs
      const { data: infRecs } = await supabase
        .from("infectious_waste_records")
        .select("collection_date, sharp_waste_kg, non_sharp_waste_kg, created_at")
        .gte("collection_date", wasteRange.from.substring(0, 10))
        .lte("collection_date", wasteRange.to.substring(0, 10));
      const existingInfKeys = new Set(
        (wasteLogsData || [])
          .filter((l: any) => (l.waste_type || "").toString().toLowerCase().includes("infect") || l.waste_type === "infectious")
          .map((l: any) => `${(l.created_at || "").substring(0, 10)}|${Number(l.weight)}`)
      );
      const extraInf = (infRecs || [])
        .map((r: any) => {
          const w = Number(r.sharp_waste_kg || 0) + Number(r.non_sharp_waste_kg || 0);
          const day = r.collection_date || (r.created_at || "").substring(0, 10);
          const key = `${day}|${w}`;
          if (existingInfKeys.has(key)) return null;
          return { waste_type: "infectious", weight: w, created_at: `${day}T08:00:00` };
        })
        .filter(Boolean) as any[];
      const combinedData = [...(wasteLogsData || []), ...extraInf];
      if (combinedData.length === 0) return { byType: [], byDay: [], total: 0, allTypes: [] };
      
      const typeMap: Record<string, number> = {}; let total = 0;
      combinedData.forEach((r) => {
        const normalized = normalizeWasteType(r.waste_type);
        const w = Number(r.weight);
        typeMap[normalized] = (typeMap[normalized] || 0) + w;
        total += w;
      });
      const byType = Object.entries(typeMap).map(([type, weight]) => ({ type, label: getWasteTypeLabel(type), weight: Number(weight.toFixed(2)) }));
      const dayMap: Record<string, Record<string, number>> = {};
      combinedData.forEach((r) => {
        const day = format(new Date(r.created_at), "d MMM", { locale: th });
        const normalized = normalizeWasteType(r.waste_type);
        if (!dayMap[day]) dayMap[day] = {};
        dayMap[day][normalized] = (dayMap[day][normalized] || 0) + Number(r.weight);
      });
      const allTypes = Object.keys(typeMap);
      const byDay = Object.entries(dayMap).map(([date, types]) => { const row: any = { date }; allTypes.forEach(t => { row[t] = Number((types[t] || 0).toFixed(2)); }); return row; });
      return { byType, byDay, total: Number(total.toFixed(2)), allTypes };
    },
  });

  const wasteTypes = useMemo(() => ["general", "infectious", "recycle", "hazardous", "organic"], []);
  const selectedForecastType = wasteTypes.includes(forecastType) ? forecastType : "general";

  const wasteForecast = useMemo(() => {
    const history = wasteHistory || [];
    const typeMap: Record<string, number> = {};
    const dayMap: Record<string, Set<string>> = {};

    history.forEach((r: any) => {
      if (normalizeWasteType(r.waste_type) !== selectedForecastType) return;
      const date = new Date(r.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      typeMap[key] = (typeMap[key] || 0) + Number(r.weight);
      if (!dayMap[key]) dayMap[key] = new Set();
      dayMap[key].add(String(date.getDate()));
    });

    const months = Object.keys(typeMap).sort();
    const hasHistory = months.length > 0;
    if (!hasHistory) {
      const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
      typeMap[currentMonthKey] = 0;
      months.push(currentMonthKey);
    }

    const recent = months.slice(-12);
    const actual = recent.map((monthKey) => {
      const [y, m] = monthKey.split("-");
      const label = format(new Date(Number(y), Number(m) - 1, 1), "MMM yy", { locale: th });
      return { month: label, monthKey, actual: Number((typeMap[monthKey] || 0).toFixed(2)), forecast: undefined };
    });

    const lastMonthKey = actual.length > 0 ? actual[actual.length - 1].monthKey : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const [lastYear, lastMonth] = lastMonthKey.split("-").map(Number);
    const lastDate = new Date(lastYear, lastMonth - 1, 1);

    // --- คำนวณ baseline อย่างถูกต้อง ---
    // 1) ไม่นำเดือนปัจจุบันที่ยังบันทึกไม่ครบเดือนมาถ่วงค่าเฉลี่ย
    const now = new Date();
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const completeMonths = actual.filter((a) => a.actual > 0 && a.monthKey !== currentKey);

    // 2) ถ้ามีเดือนที่สมบูรณ์ตั้งแต่ 2 เดือนขึ้นไป ใช้ linear regression (least squares)
    //    ถ้ามีเดือนเดียว ใช้ค่าเดือนนั้น  ถ้าไม่มีเลย ใช้อัตราเฉลี่ยต่อวันของเดือนปัจจุบัน x 30 วัน
    const fitMonths = completeMonths.slice(-6);
    let baseValue = 0;
    let slope = 0;
    if (fitMonths.length >= 2) {
      const n = fitMonths.length;
      const meanX = (n - 1) / 2;
      const meanY = fitMonths.reduce((s, r) => s + r.actual, 0) / n;
      let num = 0; let den = 0;
      fitMonths.forEach((r, i) => { num += (i - meanX) * (r.actual - meanY); den += (i - meanX) ** 2; });
      slope = den > 0 ? num / den : 0;
      // จำกัดความชันไม่ให้เกิน 20% ของค่าเฉลี่ยต่อเดือน เพื่อกันการพยากรณ์เพี้ยน
      const cap = meanY * 0.2;
      slope = Math.max(-cap, Math.min(cap, slope));
      baseValue = Math.max(0, meanY + slope * (n - 1 - meanX));
    } else if (fitMonths.length === 1) {
      baseValue = fitMonths[0].actual;
    } else {
      const daysRecorded = dayMap[currentKey]?.size || 0;
      const currentTotal = typeMap[currentKey] || 0;
      baseValue = daysRecorded > 0 ? (currentTotal / daysRecorded) * 30 : 0;
    }

    const forecast: any[] = [];
    let baseline = baseValue;
    for (let i = 1; i <= forecastHorizon; i += 1) {
      const nextDate = addMonths(lastDate, i);
      baseline = Math.max(0, baseValue + slope * i);
      const mKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`;
      forecast.push({ month: format(nextDate, "MMM yy", { locale: th }), monthKey: mKey, forecast: Number(baseline.toFixed(2)) });
    }
    const forecastTotal = forecast.reduce((sum, item) => sum + item.forecast, 0);
    const forecastAvg = forecast.length > 0 ? forecastTotal / forecast.length : 0;
    const costPerKg = wasteRates[normalizeWasteType(selectedForecastType)] ?? wasteRates.other;
    const forecastCost = Number((forecastTotal * costPerKg).toFixed(2));
    const chart = [
      ...actual.map((item) => ({ month: item.month, actual: item.actual, forecast: undefined })),
      ...forecast.map((item) => ({ month: item.month, actual: undefined, forecast: item.forecast })),
    ];

    return { chart, total: Number(forecastTotal.toFixed(2)), avg: Number(forecastAvg.toFixed(2)), cost: forecastCost, type: selectedForecastType };
  }, [wasteHistory, selectedForecastType, forecastHorizon, wasteRates]);

  const waterKpi = useMemo(() => {
    const meters = (waterStats?.meterRecords || []) as any[];
    const quality = (waterStats?.qualityLogs || []) as any[];
    const monthlyMap: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    meters.forEach((r) => {
      const date = r.record_date;
      if (!date) return;
      dailyMap[date] = (dailyMap[date] || 0) + Number(r.usage_amount || 0);
      const mKey = date.slice(0, 7);
      monthlyMap[mKey] = (monthlyMap[mKey] || 0) + Number(r.usage_amount || 0);
    });

    const monthly = Object.keys(monthlyMap).sort().slice(-6).map((mKey) => {
      const [y, m] = mKey.split("-");
      return { month: format(new Date(Number(y), Number(m) - 1, 1), "MMM yy", { locale: th }), value: Number(monthlyMap[mKey].toFixed(0)) };
    });

    const totalDays = Object.keys(dailyMap).length;
    const totalUsage = Object.values(dailyMap).reduce((sum, value) => sum + value, 0);
    const averageUsage = totalDays > 0 ? Number((totalUsage / totalDays).toFixed(0)) : 0;
    const passCount = quality.filter((r) => r.status === "pass").length;
    return { monthly, averageUsage, qualityRate: quality.length > 0 ? Math.round((passCount / quality.length) * 100) : 0, passCount, qualityTotal: quality.length };
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
          const sheets: any[] = [];
          if (repairStats && repairStats.total > 0) sheets.push({ name: "สถิติงานซ่อม", data: [{ "รายการ": "รอรับงาน", "จำนวน": repairStats.byStatus.pending || 0 }, { "รายการ": "เสร็จสิ้น", "จำนวน": repairStats.byStatus.completed || 0 }] });
          if (wasteData && wasteData.byType.length > 0) sheets.push({ name: "ขยะ", data: wasteData.byType.map(t => ({ "ประเภท": t.type, "น้ำหนัก (กก.)": t.weight })) });
          if (sheets.length > 0) { exportMultiSheet(sheets, "dashboard-report"); toast.success("ส่งออก Excel สำเร็จ"); }
          else toast.error("ไม่มีข้อมูลสำหรับส่งออก");
        }}>ส่งออก Excel</Button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricPanel label="งานซ่อมทั้งหมด" value={repairStats?.total ?? 0} sub={`รอดำเนินการ ${repairStats?.pending ?? 0} | เสร็จแล้ว ${repairStats?.completed ?? 0}`} note={`อัตราสำเร็จ ${completionRate}%`} icon={Wrench} accent="sky" onClick={() => setDrilldown("repair")} />
        <MetricPanel label="คะแนน 5ส เฉลี่ย" value={avgScore ? `${avgScore}%` : "-"} sub={`${auditByDept?.length ?? 0} แผนก`} note={avgScore && avgScore >= 70 ? "ผ่านเกณฑ์" : "ต่ำกว่าเกณฑ์"} icon={CheckCircle} accent="teal" onClick={() => setDrilldown("5s")} />
        <MetricPanel label="ถังดับเพลิง" value={fireChecks ? `${fireChecks.rate}%` : "-"} sub={`ปกติ ${fireChecks?.ok ?? 0}/${fireChecks?.total ?? 0}`} note={fireChecks && fireChecks.rate >= 80 ? "สภาพดี" : "ต้องตรวจสอบ"} icon={Flame} accent="red" onClick={() => setDrilldown("fire")} />
        <MetricPanel label="น้ำหนักขยะ" value={wasteData ? `${wasteData.total} กก.` : "-"} sub={`ช่วง ${filterLabel[wasteFilter]}`} note={`${wasteData?.byType?.length ?? 0} ประเภทขยะ`} icon={Trash2} accent="rose" onClick={() => setDrilldown("waste")} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricPanel label="ENV Round" value={envRoundStats?.totalRounds ?? 0} sub={`เสร็จสิ้น ${envRoundStats?.completed ?? 0}`} note={`พบปัญหา ${envRoundStats?.abnormal ?? 0} จุด`} icon={Search} accent="cyan" onClick={() => setDrilldown("env")} />
        <MetricPanel label="สารเคมีคลัง" value={hazmatStats?.total ?? 0} sub={`สต็อกต่ำ ${hazmatStats?.lowStock ?? 0}`} note={`หมดอายุ ${hazmatStats?.expired ?? 0} รายการ`} icon={FlaskConical} accent="amber" onClick={() => navigate("/hazmat")} />
        <MetricPanel label="ปัญหาที่ต้องจัดการ" value={(issueStats?.pending ?? 0) + (issueStats?.in_progress ?? 0)} sub={`รอ ${issueStats?.pending ?? 0} | ดำเนินการ ${issueStats?.in_progress ?? 0}`} note={`แก้ไขแล้ว ${issueStats?.resolved ?? 0}`} icon={AlertTriangle} accent="red" onClick={() => navigate("/issues")} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {avgScore ? (
          <Card className="bg-white rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">คะแนน 5ส เฉลี่ย</h3>
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="90%" data={[{ name: "5ส", value: avgScore, fill: "#0097a7" }]} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={12} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#0097a7">{avgScore}%</text>
                </RadialBarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : null}

        {repairStats && repairStats.statusPie.length > 0 && (
          <Card className="bg-white rounded-2xl border-0 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4">สถานะงานซ่อม</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={repairStats.statusPie} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                    {repairStats.statusPie.map((entry: any, i: number) => <Cell key={i} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v} รายการ`} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="bg-white rounded-2xl border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800">น้ำหนักขยะหลัก</h3>
            <Badge variant="secondary" className="bg-sky-50 text-sky-700">{filterLabel[wasteFilter]}</Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            {(["day", "week", "month"] as WasteFilter[]).map((f) => (
              <Button key={f} size="sm" variant={wasteFilter === f ? "default" : "outline"} onClick={() => setWasteFilter(f)} className={cn("rounded-2xl px-4", wasteFilter === f ? "bg-[#0097a7] text-slate-900" : "bg-white text-slate-600")}>
                {f === "day" ? "รายวัน" : f === "week" ? "รายสัปดาห์" : "รายเดือน"}
              </Button>
            ))}
            <Button size="sm" variant={wasteFilter === "custom" ? "default" : "outline"} onClick={() => setWasteFilter("custom")} className="rounded-2xl">เลือกช่วง</Button>
          </div>

          {wasteFilter === "custom" && (
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm" className="rounded-2xl">{customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white"><Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} /></PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild><Button variant="outline" size="sm" className="rounded-2xl">{customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}</Button></PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-white"><Calendar mode="single" selected={customTo} onSelect={setCustomTo} /></PopoverContent>
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
                       <Pie data={wasteData.byType} dataKey="weight" nameKey="label" cx="50%" cy="50%" innerRadius={40} outerRadius={80} paddingAngle={4}>
                         {wasteData.byType.map((entry, i) => <Cell key={i} fill={getWasteColor(entry.type)} />)}
                       </Pie>
                      <Tooltip formatter={(v) => `${v} กก.`} />
                      <Legend iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {wasteData.byDay.length > 1 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-600 mb-3">แนวโน้มรายวัน</h4>
                    <ResponsiveContainer width="100%" height={220}>
                      <AreaChart data={wasteData.byDay}>
                         <defs>
                          {wasteData.allTypes.map((type, i) => (
                            <linearGradient key={type} id={`wasteGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={getWasteColor(type)} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={getWasteColor(type)} stopOpacity={0.05} />
                            </linearGradient>
                          ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                         {wasteData.allTypes.map((type, i) => (
                          <Area key={type} type="monotone" dataKey={type} name={getWasteTypeLabel(type)} fill={`url(#wasteGrad${i})`} stroke={getWasteColor(type)} strokeWidth={2} />
                        ))}
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-5 bg-slate-50">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-700">ระบบพยากรณ์ปริมาณขยะล่วงหน้า</h4>
                    <p className="text-xs text-slate-500">คำนวณจากสถิติฐานข้อมูลจริงในระบบ</p>
                  </div>
                  <div className="flex gap-2">
                    <select value={selectedForecastType} onChange={(e) => setForecastType(e.target.value)} className="h-9 rounded-xl border border-slate-300 bg-white px-3 text-sm">
                      {wasteTypes.map((t) => <option key={t} value={t}>{getWasteTypeLabel(t)}</option>)}
                    </select>
                    {([3, 6, 12] as const).map((m) => (
                      <Button key={m} size="sm" variant={forecastHorizon === m ? "default" : "outline"} className="rounded-xl px-3" onClick={() => setForecastHorizon(m)}>{m} เดือน</Button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-3 mt-4">
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded-xl border"><p className="text-xs text-slate-500">ประเภท</p><p className="text-base font-bold">{getWasteTypeLabel(wasteForecast.type)}</p></div>
                    <div className="bg-white p-4 rounded-xl border"><p className="text-xs text-slate-500">ปริมาณพยากรณ์รวม</p><p className="text-xl font-bold">{wasteForecast.total} กก.</p></div>
                    <div className="bg-white p-4 rounded-xl border"><p className="text-xs text-slate-500">คาดการณ์ค่าใช้จ่าย</p><p className="text-xl font-bold text-emerald-600">{wasteForecast.cost} ฿</p></div>
                  </div>
                  <div className="lg:col-span-2 bg-white p-4 rounded-xl border">
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={wasteForecast.chart}>
                        <defs>
                          <linearGradient id="fActual" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} /><stop offset="95%" stopColor="#22c55e" stopOpacity={0.01} /></linearGradient>
                          <linearGradient id="fLine" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={0.3} /><stop offset="95%" stopColor="#f97316" stopOpacity={0.01} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="actual" stroke="#22c55e" fill="url(#fActual)" strokeWidth={2} connectNulls />
                        <Area type="monotone" dataKey="forecast" stroke="#f97316" fill="url(#fLine)" strokeDasharray="4 4" strokeWidth={2} connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-6">ไม่มีข้อมูลขยะในช่วงเวลาที่เลือก</p>
          )}
        </CardContent>
      </Card>

      {/* Drilldowns */}
      <Dialog open={drilldown === "waste"} onOpenChange={(open) => !open && setDrilldown(null)}>
        <DialogContent className="max-w-md rounded-2xl bg-white">
          <DialogHeader><DialogTitle>รายละเอียดสถิติน้ำหนักขยะ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-rose-50 p-4 text-center rounded-xl border border-rose-100"><p className="text-3xl font-extrabold text-rose-600">{wasteData?.total ?? 0} กก.</p><p className="text-xs text-rose-500">ยอดรวมสอดคล้องกับหน้าจัดการขยะ</p></div>
            {wasteData?.byType.map((t, i) => (
              <div key={i} className="flex justify-between p-3 bg-slate-50 rounded-xl"><span>{t.label}</span><span className="font-bold">{t.weight} กก.</span></div>
            ))}
            <Button className="w-full bg-[#0097a7] text-slate-900" onClick={() => { setDrilldown(null); navigate("/waste"); }}>ไปหน้าจัดการขยะ</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
