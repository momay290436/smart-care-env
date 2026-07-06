import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { format, subDays, subWeeks, startOfWeek, endOfWeek, subMonths, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { th } from "date-fns/locale";
import { Droplets, TrendingUp, Upload } from "lucide-react";
import { toast } from "sonner";

export default function WaterSystemTab() {
  const [forecastMode, setForecastMode] = useState<"weekly" | "monthly">("weekly");

  const { data: meterRecords = [] } = useQuery({
    queryKey: ["water-meter-forecast"],
    queryFn: async () => {
      const { data } = await supabase.from("water_meter_records").select("record_date, usage_amount").order("record_date", { ascending: true }).limit(500);
      return data || [];
    },
  });

  // Aggregate daily usage
  const dailyUsage = useMemo(() => {
    const map: Record<string, number> = {};
    meterRecords.forEach((r: any) => {
      map[r.record_date] = (map[r.record_date] || 0) + Number(r.usage_amount || 0);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [meterRecords]);

  // Simple forecast using moving average
  const forecastData = useMemo(() => {
    if (dailyUsage.length < 3) return [];
    const recentN = Math.min(30, dailyUsage.length);
    const recent = dailyUsage.slice(-recentN);
    const avg = recent.reduce((s, [, v]) => s + v, 0) / recent.length;
    const variance = recent.reduce((s, [, v]) => s + Math.pow(v - avg, 2), 0) / recent.length;
    const std = Math.sqrt(variance);

    const forecastDays = forecastMode === "weekly" ? 7 : 30;
    const result: any[] = [];

    // Last 7 days actual
    const lastWeek = dailyUsage.slice(-7);
    lastWeek.forEach(([date, usage]) => {
      result.push({ date: format(new Date(date), "d MMM", { locale: th }), actual: Math.round(usage), forecast: null });
    });

    // Forecast
    for (let i = 1; i <= forecastDays; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const dayOfWeek = d.getDay();
      const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.85 : 1.05;
      const predicted = Math.round(avg * weekendFactor + (Math.random() - 0.5) * std * 0.3);
      result.push({ date: format(d, "d MMM", { locale: th }), actual: null, forecast: Math.max(0, predicted) });
    }
    return result;
  }, [dailyUsage, forecastMode]);

  // 48-hour reserve calculation
  const avgDailyUsage = useMemo(() => {
    if (dailyUsage.length < 3) return 0;
    const last7 = dailyUsage.slice(-7);
    return Math.round(last7.reduce((s, [, v]) => s + v, 0) / last7.length);
  }, [dailyUsage]);

  const reserveNeeded = avgDailyUsage * 2; // 48 hours

  return (
    <div className="space-y-4 w-full">
      {/* Blueprint Section */}
      <Card className="relative w-full bg-white rounded-3xl shadow-lg hover:shadow-2xl border-0 overflow-hidden transition-all duration-300">
        <div className="absolute top-0 left-0 w-32 h-32 bg-blue-100/20 rounded-full -ml-16 -mt-16 backdrop-blur-sm" />
        <CardContent className="p-6 space-y-4 relative z-10">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Droplets className="h-6 w-6 text-blue-500" /> ผังระบบประปา (พิมพ์เขียว)
          </h3>
          <div className="border-2 border-dashed border-slate-300 rounded-3xl p-10 text-center bg-gradient-to-br from-slate-50 to-blue-50/30">
            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm text-slate-600 font-medium">ยังไม่มีผังระบบ</p>
            <Button variant="outline" size="sm" className="mt-4 rounded-2xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300" onClick={() => toast.info("ฟังก์ชันอัปโหลดผัง - กำลังพัฒนา")}>
              อัปโหลดผังระบบ
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 48-hour Reserve */}
      <Card className="relative w-full bg-white rounded-3xl shadow-lg hover:shadow-2xl border-0 overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-100/20 rounded-full -mr-16 -mt-16 backdrop-blur-sm" />
        <CardContent className="p-6 space-y-4 relative z-10">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Droplets className="h-6 w-6 text-cyan-500" /> ระบบสำรองน้ำ 48 ชั่วโมง
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200/50 shadow-sm hover:shadow-md transition-all">
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">ใช้น้ำเฉลี่ย/วัน</p>
              <p className="text-2xl font-extrabold text-blue-700 mt-2">{avgDailyUsage.toLocaleString()}</p>
              <p className="text-xs text-slate-600 mt-1">ลบ.ม.</p>
            </div>
            <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-50 to-teal-50 border border-cyan-200/50 shadow-sm hover:shadow-md transition-all">
              <p className="text-xs text-slate-600 font-semibold uppercase tracking-wide">ต้องสำรอง 48 ชม.</p>
              <p className="text-2xl font-extrabold text-cyan-700 mt-2">{reserveNeeded.toLocaleString()}</p>
              <p className="text-xs text-slate-600 mt-1">ลบ.ม.</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 bg-blue-50/50 rounded-xl p-3 border border-blue-100/50">📌 คำนวณจากค่าเฉลี่ย 7 วันล่าสุด × 2 วัน เพื่อรองรับกรณีน้ำจากส่วนกลางไม่ไหล</p>
        </CardContent>
      </Card>

      {/* Forecast */}
      <Card className="relative w-full bg-white rounded-3xl shadow-lg hover:shadow-2xl border-0 overflow-hidden transition-all duration-300">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-100/20 rounded-full -mr-20 -mt-20 backdrop-blur-sm" />
        <CardContent className="p-6 space-y-4 relative z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-500" /> พยากรณ์การใช้น้ำ
            </h3>
            <Select value={forecastMode} onValueChange={(v) => setForecastMode(v as any)}>
              <SelectTrigger className="w-32 h-10 rounded-2xl text-xs font-medium bg-white border-slate-300 hover:border-slate-400 shadow-sm"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-2xl">
                <SelectItem value="weekly">รายสัปดาห์</SelectItem>
                <SelectItem value="monthly">รายเดือน</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {forecastData.length > 0 ? (
            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 rounded-2xl p-4 border border-slate-200/50">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={forecastData}>
                  <defs>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0891b2" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#0891b2" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748b" />
                  <YAxis tick={{ fontSize: 11 }} stroke="#64748b" />
                  <Tooltip contentStyle={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)', border: 'none' }} />
                  <Area type="monotone" dataKey="actual" stroke="#0891b2" strokeWidth={2.5} fill="url(#actualGrad)" name="ใช้จริง (ลบ.ม.)" connectNulls={false} />
                  <Area type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={2.5} fill="url(#forecastGrad)" strokeDasharray="5 5" name="พยากรณ์ (ลบ.ม.)" connectNulls={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-600 text-center py-10 bg-slate-50/50 rounded-2xl">ต้องมีข้อมูลมิเตอร์น้ำอย่างน้อย 3 วัน เพื่อพยากรณ์</p>
          )}
          <div className="flex gap-6 text-xs font-medium bg-slate-50/50 p-3 rounded-2xl">
            <span className="flex items-center gap-2"><span className="w-4 h-0.5 bg-cyan-600 inline-block rounded-full" /> ใช้จริง</span>
            <span className="flex items-center gap-2"><span className="w-4 h-0.5 bg-amber-500 inline-block border-t-2 border-dashed" /> พยากรณ์</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
