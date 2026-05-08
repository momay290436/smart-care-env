import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";
import PageHeader from "@/components/PageHeader";
import WaterPathogenTab from "@/components/WaterPathogenTab";
import WaterMaintenanceTab from "@/components/WaterMaintenanceTab";
import WaterSystemTab from "@/components/WaterSystemTab";
import WaterQualityBatchForm from "@/components/WaterQualityBatchForm";
import { Droplets, Gauge, AlertTriangle, Plus, ClipboardList, Wrench, Download, Settings, Shield, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const CHECK_POINTS = ["อาคาร OPD", "อาคาร IPD ชาย", "อาคาร IPD หญิง", "อาคารอำนวยการ", "ห้องผ่าตัด", "ห้องปฏิบัติการ", "โรงครัว"];

const PM_ALERTS = [
  { title: "กำหนดล้างถังพักน้ำอาคาร A", schedule: "ทุก 6 เดือน", due: "15 มิ.ย. 2569", status: "upcoming" },
  { title: "เปลี่ยนไส้กรองเครื่องกรองน้ำ RO", schedule: "ทุก 3 เดือน", due: "1 พ.ค. 2569", status: "due" },
  { title: "ตรวจปั๊มน้ำสำรอง", schedule: "ทุกเดือน", due: "30 เม.ย. 2569", status: "overdue" },
  { title: "ล้างถังเก็บน้ำดาดฟ้า", schedule: "ทุก 6 เดือน", due: "1 ก.ค. 2569", status: "upcoming" },
];

export default function WaterManagement() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMeterDialog, setShowMeterDialog] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const [meterNotes, setMeterNotes] = useState("");
  const [formData, setFormData] = useState({ check_point: "", ph_value: "", chlorine_value: "", turbidity_value: "", notes: "" });
  const [meterStartDate, setMeterStartDate] = useState<Date | undefined>();
  const [meterEndDate, setMeterEndDate] = useState<Date | undefined>();

  const { data: qualityLogs = [] } = useQuery({
    queryKey: ["water-quality-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("water_quality_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
  });

  const { data: meterRecords = [] } = useQuery({
    queryKey: ["water-meter-all"],
    queryFn: async () => {
      const { data } = await supabase.from("water_meter_records").select("*").order("record_date", { ascending: false }).order("record_time", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const avgChlorine = useMemo(() => {
    const recent = qualityLogs.filter((l: any) => l.chlorine_value != null).slice(0, 20);
    if (recent.length === 0) return null;
    return (recent.reduce((s: number, l: any) => s + Number(l.chlorine_value), 0) / recent.length).toFixed(2);
  }, [qualityLogs]);

  const normalPoints = useMemo(() => {
    const latest: Record<string, any> = {};
    qualityLogs.forEach((l: any) => { if (!latest[l.check_point]) latest[l.check_point] = l; });
    const all = Object.values(latest);
    const normal = all.filter((l: any) => l.status === "pass").length;
    return { normal, total: all.length };
  }, [qualityLogs]);

  // Water usage chart (7 days)
  const usageChart = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "yyyy-MM-dd");
      days[d] = 0;
    }
    meterRecords.forEach((r: any) => {
      if (days[r.record_date] !== undefined) {
        days[r.record_date] += Number(r.usage_amount || 0);
      }
    });
    return Object.entries(days).map(([date, usage]) => ({
      date: format(new Date(date), "d MMM", { locale: th }),
      usage: Number(usage.toFixed(0)),
    }));
  }, [meterRecords]);

  // Grouped meter records for inline table
  const groupedMeter = useMemo(() => {
    const map: Record<string, any[]> = {};
    meterRecords.forEach((r: any) => {
      if (!map[r.record_date]) map[r.record_date] = [];
      map[r.record_date].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [meterRecords]);

  // Filter meter records by date range
  const filteredMeterRecords = useMemo(() => {
    return meterRecords.filter((r: any) => {
      if (meterStartDate && new Date(r.record_date) < startOfDay(meterStartDate)) return false;
      if (meterEndDate && new Date(r.record_date) > new Date(startOfDay(meterEndDate).getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [meterRecords, meterStartDate, meterEndDate]);

  // Grouped filtered meter records
  const groupedFilteredMeter = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredMeterRecords.forEach((r: any) => {
      if (!map[r.record_date]) map[r.record_date] = [];
      map[r.record_date].push(r);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredMeterRecords]);

  // Export water meter records to Excel
  const handleExportMeterRecords = () => {
    if (filteredMeterRecords.length === 0) {
      toast.error("ไม่มีข้อมูลการบันทึกมิเตอร์น้ำในช่วงวันที่ที่เลือก");
      return;
    }

    const wb = XLSX.utils.book_new();
    const headers = ["วันที่", "เวลา", "มิเตอร์น้ำออก", "จำนวนน้ำที่ใช้ไป", "ผลรวมรายวัน", "ผู้บันทึก", "หมายเหตุ"];
    const rows: any[][] = [headers];
    const merges: XLSX.Range[] = [];
    let rowIdx = 1;

    groupedFilteredMeter.forEach(([date, dateRecords]) => {
      const sorted = [...dateRecords].sort((a: any, b: any) => a.record_time.localeCompare(b.record_time));
      const dailyTotal = sorted.reduce((s: number, r: any) => s + Number(r.usage_amount || 0), 0);
      const startRow = rowIdx;
      
      sorted.forEach((r: any) => {
        rows.push([
          format(new Date(date), "d/M/yyyy"),
          r.record_time?.substring(0, 5) || "-",
          Number(r.meter_reading),
          Number(r.usage_amount || 0),
          dailyTotal > 0 ? dailyTotal : "",
          r.recorder_name || "-",
          r.notes || "-",
        ]);
        rowIdx++;
      });

      // Merge date column (col 0) for same-date rows
      if (sorted.length > 1) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: rowIdx - 1, c: 0 } });
      }
      // Merge daily_total column (col 4) for same-date rows
      if (sorted.length > 1) {
        merges.push({ s: { r: startRow, c: 4 }, e: { r: rowIdx - 1, c: 4 } });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = merges;
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 15 }, { wch: 16 }, { wch: 20 }];
    
    // Set header style
    for (let i = 0; i < headers.length; i++) {
      const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
      if (!ws[cellRef]) ws[cellRef] = {};
      ws[cellRef].s = {
        fill: { fgColor: { rgb: "1e40af" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }

    XLSX.utils.book_append_sheet(wb, ws, "มิเตอร์น้ำ");
    XLSX.writeFile(wb, `water-meter-records-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  const addQualityLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const ph = formData.ph_value ? Number(formData.ph_value) : null;
      const cl = formData.chlorine_value ? Number(formData.chlorine_value) : null;
      const turb = formData.turbidity_value ? Number(formData.turbidity_value) : null;
      const pass = (!cl || (cl >= 0.2 && cl <= 0.5)) && (!ph || (ph >= 6.5 && ph <= 8.5)) && (!turb || turb <= 5);
      const { error } = await supabase.from("water_quality_logs").insert({
        check_point: formData.check_point, ph_value: ph, chlorine_value: cl, turbidity_value: turb,
        status: pass ? "pass" : "fail", notes: formData.notes || null, recorded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลตรวจคุณภาพน้ำสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-quality-logs"] });
      setShowAddDialog(false);
      setFormData({ check_point: "", ph_value: "", chlorine_value: "", turbidity_value: "", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addMeterRecord = useMutation({
    mutationFn: async () => {
      if (!user || !meterReading) throw new Error("กรุณากรอกเลขมิเตอร์");
      const reading = Number(meterReading);
      const now = new Date();
      const hour = now.getHours();
      const shift = hour < 12 ? "morning" : "afternoon";
      const todayStr = format(now, "yyyy-MM-dd");
      const timeStr = format(now, "HH:mm:ss");
      const { data: prev } = await supabase.from("water_meter_records").select("meter_reading").order("record_date", { ascending: false }).order("record_time", { ascending: false }).limit(1);
      const prevReading = prev && prev.length > 0 ? Number(prev[0].meter_reading) : reading;
      const usageAmount = Math.max(0, reading - prevReading);
      let dailyTotal: number | null = null;
      if (shift === "afternoon") {
        const { data: todayRecs } = await supabase.from("water_meter_records").select("usage_amount").eq("record_date", todayStr).eq("shift", "morning");
        if (todayRecs && todayRecs.length > 0) dailyTotal = Number(todayRecs[0].usage_amount) + usageAmount;
      }
      const { error } = await supabase.from("water_meter_records").insert({
        record_date: todayStr, record_time: timeStr, shift, meter_reading: reading,
        usage_amount: usageAmount, daily_total: dailyTotal, recorded_by: user.id,
        recorder_name: profile?.full_name || "", notes: meterNotes || null,
      });
      if (error) throw error;
      if (shift === "afternoon" && dailyTotal !== null) {
        await supabase.from("water_meter_records").update({ daily_total: dailyTotal }).eq("record_date", todayStr).eq("shift", "morning");
      }
    },
    onSuccess: () => {
      toast.success("บันทึกมิเตอร์น้ำสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-meter-all"] });
      queryClient.invalidateQueries({ queryKey: ["water-meter-records"] });
      queryClient.invalidateQueries({ queryKey: ["water-meter-recent"] });
      setShowMeterDialog(false);
      setMeterReading("");
      setMeterNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const waterLevel = 78;
  const now = new Date();
  const currentShift = now.getHours() < 12 ? "รอบเช้า (ก่อน 12:00)" : "รอบบ่าย (หลัง 12:00)";

  return (
    <div className="space-y-4 md:space-y-6 pb-6">
      <PageHeader title="ระบบจัดการน้ำประปา" subtitle="Water & FMS Management (HAI Standard)">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1.5 bg-white/20 border-white/30 text-white hover:bg-white/30" onClick={() => {
          exportToExcel(qualityLogs.map((l: any) => ({
            "วันที่": format(new Date(l.created_at), "d MMM yyyy", { locale: th }),
            "จุดตรวจ": l.check_point, "pH": l.ph_value ?? "-",
            "คลอรีน (mg/l)": l.chlorine_value ?? "-", "ความขุ่น (NTU)": l.turbidity_value ?? "-",
            "สถานะ": l.status === "pass" ? "ผ่าน" : "ไม่ผ่าน", "หมายเหตุ": l.notes || "-",
          })), "water-quality", "คุณภาพน้ำ");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
      </PageHeader>

      {/* Water Meter Button - TOP on mobile */}
      <Card className="bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 rounded-2xl shadow-xl border-0 cursor-pointer hover:shadow-2xl transition-all active:scale-[0.97] ring-2 ring-blue-300/50 animate-pulse-subtle" onClick={() => setShowMeterDialog(true)}>
        <CardContent className="p-5 md:p-6 flex items-center gap-4">
          <div className="w-16 h-16 md:w-14 md:h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner">
            <Plus className="h-8 w-8 md:h-7 md:w-7 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg md:text-xl font-extrabold text-white">📝 บันทึกมิเตอร์น้ำออก</p>
            <p className="text-sm md:text-base text-white/80 truncate">กดเพื่อบันทึกค่ามิเตอร์ทันที</p>
          </div>
        </CardContent>
      </Card>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-blue-500">
          <CardContent className="p-3 md:p-4 text-center">
            <Droplets className="h-5 w-5 md:h-6 md:w-6 text-blue-500 mx-auto mb-1" />
            <p className="text-xl md:text-2xl font-extrabold text-blue-600">{waterLevel}%</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">ระดับน้ำสำรอง</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-teal-500">
          <CardContent className="p-3 md:p-4 text-center">
            <Gauge className="h-5 w-5 md:h-6 md:w-6 text-teal-500 mx-auto mb-1" />
            <p className="text-xl md:text-2xl font-extrabold text-teal-600">{avgChlorine ?? "-"}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">คลอรีน (mg/l)</p>
            <p className="text-[9px] md:text-[10px] text-muted-foreground">เป้าหมาย 0.2-0.5</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-emerald-500">
          <CardContent className="p-3 md:p-4 text-center">
            <AlertTriangle className="h-5 w-5 md:h-6 md:w-6 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl md:text-2xl font-extrabold text-emerald-600">{normalPoints.normal}/{normalPoints.total}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">จุดน้ำไหลปกติ</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: คุณภาพน้ำ / ระบบ / ตรวจเชื้อ / บำรุงรักษา */}
      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto rounded-2xl bg-white shadow-sm p-1 gap-1">
          <TabsTrigger value="quality" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Droplets className="h-4 w-4 mr-1" /> คุณภาพน้ำ
          </TabsTrigger>
          <TabsTrigger value="meter" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
            <Gauge className="h-4 w-4 mr-1" /> มิเตอร์น้ำ
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-1" /> บริหารระบบ
          </TabsTrigger>
          <TabsTrigger value="pathogen" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-rose-500 data-[state=active]:text-white">
            <Shield className="h-4 w-4 mr-1" /> ตรวจเชื้อ
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Wrench className="h-4 w-4 mr-1" /> บำรุงรักษา
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="mt-4">
          <WaterSystemTab />
        </TabsContent>

        <TabsContent value="pathogen" className="mt-4">
          <WaterPathogenTab />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <WaterMaintenanceTab />
        </TabsContent>

        <TabsContent value="meter" className="mt-4">
          <div className="space-y-4">
            {/* Date Range Filter */}
            <Card className="bg-white rounded-2xl shadow-elevated border-0">
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-2 items-center">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">กรองวันที่:</span>
                  {[
                    { val: meterStartDate, set: setMeterStartDate, placeholder: "วันเริ่มต้น" },
                    { val: meterEndDate, set: setMeterEndDate, placeholder: "วันสิ้นสุด" },
                  ].map((cfg, i) => (
                    <Popover key={i}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("text-sm h-9 w-36 justify-start rounded-2xl", !cfg.val && "text-slate-400")}>
                          {cfg.val ? format(cfg.val, "d MMM yy", { locale: th }) : cfg.placeholder}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={cfg.val} onSelect={cfg.set} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  ))}
                  {(meterStartDate || meterEndDate) && (
                    <Button variant="ghost" size="sm" className="text-xs rounded-2xl" onClick={() => { setMeterStartDate(undefined); setMeterEndDate(undefined); }}>ล้าง</Button>
                  )}
                  <div className="flex-1" />
                  <Button size="sm" className="rounded-2xl gap-2 bg-blue-600 hover:bg-blue-700" onClick={handleExportMeterRecords}>
                    <Download className="h-4 w-4" /> ส่งออก Excel
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Meter Records Table */}
            <Card className="bg-white rounded-2xl shadow-elevated border-0">
              <CardContent className="p-4">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Gauge className="h-5 w-5 text-cyan-500" /> ประวัติการบันทึกมิเตอร์น้ำ
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-cyan-200 bg-cyan-50/50">
                        <th className="text-left py-3 px-2 text-xs font-bold text-cyan-700">วันที่</th>
                        <th className="text-center py-3 px-2 text-xs font-bold text-cyan-700">เวลา</th>
                        <th className="text-right py-3 px-2 text-xs font-bold text-cyan-700">มิเตอร์น้ำออก</th>
                        <th className="text-right py-3 px-2 text-xs font-bold text-cyan-700">จำนวนน้ำที่ใช้ไป</th>
                        <th className="text-right py-3 px-2 text-xs font-bold text-cyan-700">ผลรวมรายวัน</th>
                        <th className="text-center py-3 px-2 text-xs font-bold text-cyan-700">ผู้บันทึก</th>
                        <th className="text-left py-3 px-2 text-xs font-bold text-cyan-700">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedFilteredMeter.map(([date, dateRecords]) => (
                        dateRecords.sort((a: any, b: any) => a.record_time.localeCompare(b.record_time)).map((r: any, i: number) => (
                          <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                            {i === 0 ? (
                              <td className="py-2.5 px-2 text-xs font-semibold border-r border-slate-100" rowSpan={dateRecords.length}>
                                {format(new Date(date), "d/M/yy")}
                              </td>
                            ) : null}
                            <td className="py-2.5 px-2 text-center text-xs">{r.record_time?.substring(0, 5)}</td>
                            <td className="py-2.5 px-2 text-right text-xs font-mono font-semibold">{Number(r.meter_reading).toLocaleString()}</td>
                            <td className="py-2.5 px-2 text-right text-xs font-mono">{Number(r.usage_amount || 0).toLocaleString()}</td>
                            <td className="py-2.5 px-2 text-right text-xs font-mono font-bold text-cyan-600">{r.daily_total != null ? Number(r.daily_total).toLocaleString() : "-"}</td>
                            <td className="py-2.5 px-2 text-center text-xs">{r.recorder_name || "-"}</td>
                            <td className="py-2.5 px-2 text-xs text-muted-foreground">{r.notes || "-"}</td>
                          </tr>
                        ))
                      ))}
                      {filteredMeterRecords.length === 0 && (
                        <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูลการบันทึกมิเตอร์น้ำในช่วงวันที่ที่เลือก</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Water Usage Chart */}
            <Card className="bg-white rounded-2xl shadow-elevated border-0">
              <CardContent className="p-4 md:p-5">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-500" /> ปริมาณการใช้น้ำ 7 วันย้อนหลัง
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={usageChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v} ลบ.ม.`, "ปริมาณน้ำ"]} />
                    <Line type="monotone" dataKey="usage" stroke="#0891b2" strokeWidth={2.5} dot={{ fill: "#0891b2", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-4">
          <div className="space-y-4">
            {/* Water Quality Batch Form */}
            <WaterQualityBatchForm />

            {/* Water Usage Chart */}
            <Card className="bg-white rounded-2xl shadow-elevated border-0">
              <CardContent className="p-4 md:p-5">
                <h3 className="text-base md:text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Droplets className="h-5 w-5 text-blue-500" /> ปริมาณการใช้น้ำ 7 วันย้อนหลัง
                </h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={usageChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v} ลบ.ม.`, "ปริมาณน้ำ"]} />
                    <Line type="monotone" dataKey="usage" stroke="#0891b2" strokeWidth={2.5} dot={{ fill: "#0891b2", r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
      <Dialog open={showMeterDialog} onOpenChange={setShowMeterDialog}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5 text-blue-500" /> บันทึกมิเตอร์น้ำออก
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-3 space-y-1 text-sm">
              <p><span className="font-semibold">วันที่:</span> {now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><span className="font-semibold">เวลา:</span> {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
              <p><span className="font-semibold">รอบ:</span> {currentShift}</p>
              <p><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
            </div>
            <div>
              <Label className="font-semibold">เลขมิเตอร์น้ำออก *</Label>
              <Input type="number" value={meterReading} onChange={(e) => setMeterReading(e.target.value)} placeholder="เช่น 167463" className="h-12 rounded-2xl text-lg font-mono" />
            </div>
            <div>
              <Label className="font-semibold">หมายเหตุ</Label>
              <Textarea value={meterNotes} onChange={(e) => setMeterNotes(e.target.value)} placeholder="ข้อสังเกตเพิ่มเติม (ถ้ามี)..." rows={2} className="rounded-2xl" />
            </div>
            <p className="text-xs text-muted-foreground">💡 ระบบจะคำนวณ "จำนวนน้ำที่ใช้ไป" อัตโนมัติจากเลขมิเตอร์ครั้งก่อนหน้า</p>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addMeterRecord.mutate()} disabled={addMeterRecord.isPending || !meterReading}>
              {addMeterRecord.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Quality Log Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-blue-500" /> บันทึกผลตรวจคุณภาพน้ำ
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-3 space-y-1">
              <p className="text-sm"><span className="font-semibold">วันที่:</span> {now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="text-sm"><span className="font-semibold">เวลา:</span> {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
              <p className="text-sm"><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">จุดตรวจ *</Label>
              <Select value={formData.check_point} onValueChange={(v) => setFormData({ ...formData, check_point: v })}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue placeholder="เลือกจุดตรวจ" /></SelectTrigger>
                <SelectContent>
                  {CHECK_POINTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs font-semibold">pH (6.5-8.5)</Label>
                <Input type="number" step="0.1" placeholder="7.0" value={formData.ph_value} onChange={(e) => setFormData({ ...formData, ph_value: e.target.value })} className="h-11 rounded-2xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">คลอรีน (mg/l)</Label>
                <Input type="number" step="0.01" placeholder="0.3" value={formData.chlorine_value} onChange={(e) => setFormData({ ...formData, chlorine_value: e.target.value })} className="h-11 rounded-2xl" />
              </div>
              <div>
                <Label className="text-xs font-semibold">ความขุ่น (NTU)</Label>
                <Input type="number" step="0.1" placeholder="1.0" value={formData.turbidity_value} onChange={(e) => setFormData({ ...formData, turbidity_value: e.target.value })} className="h-11 rounded-2xl" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1">
              <p>📌 เกณฑ์มาตรฐาน สรพ. (HAI):</p>
              <p>• คลอรีนอิสระ: 0.2 - 0.5 mg/l</p>
              <p>• pH: 6.5 - 8.5</p>
              <p>• ความขุ่น: ≤ 5 NTU</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">หมายเหตุ</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="ข้อสังเกตเพิ่มเติม..." rows={2} className="rounded-2xl" />
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addQualityLog.mutate()} disabled={addQualityLog.isPending || !formData.check_point}>
              {addQualityLog.isPending ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
