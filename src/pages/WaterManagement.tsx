import { useState, useMemo, useEffect, Fragment } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from "recharts";
import { format, subDays, startOfDay, endOfDay, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";
import PageHeader from "@/components/PageHeader";
import WaterMaintenanceTab from "@/components/WaterMaintenanceTab";
import WaterSystemTab from "@/components/WaterSystemTab";
import WaterQualityBatchForm from "@/components/WaterQualityBatchForm";
import { Droplets, Gauge, AlertTriangle, Plus, Wrench, Download, Settings, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const CHECK_POINTS = ["อาคาร OPD", "อาคาร IPD ชาย", "อาคาร IPD หญิง", "อาคารอำนวยการ", "ห้องผ่าตัด", "ห้องปฏิบัติการ", "โรงครัว"];

const METER_NOTE_OPTIONS = [
  "ล้างถังกรอง",
  "ตักทราย",
  "ดันหน้าทราย",
  "เปลี่ยนทราย",
  "อื่นๆ(ระบุ)",
];

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
  const [showDisinfectantDialog, setShowDisinfectantDialog] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const [meterNotes, setMeterNotes] = useState<string[]>([]);
  const [meterNotesOther, setMeterNotesOther] = useState("");
  const [formData, setFormData] = useState({ check_point: "", ph_value: "", chlorine_value: "", turbidity_value: "", notes: "" });
  const [disinfectantForm, setDisinfectantForm] = useState({ disinfectant_name: "คลอรีน", source_concentration: "", source_ph: "", outlet_concentration: "", outlet_ph: "", notes: "" });
  const [filterStartDate, setFilterStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [filterEndDate, setFilterEndDate] = useState<Date | undefined>(new Date());
  const [meterContentTab, setMeterContentTab] = useState<"meter" | "disinfectant">("meter");

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

  const { data: disinfectantLogs = [] } = useQuery({
    queryKey: ["water-disinfectant-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("water_disinfectant_logs").select("*").order("check_date", { ascending: false }).order("check_time", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const safeInsertDisinfectant = async (payload: any) => {
    const attemptInsert = async () => {
      const { error } = await supabase.from("water_disinfectant_logs").insert(payload);
      return error;
    };

    let error = await attemptInsert();
    if (error?.message?.includes("Could not find the table") || error?.message?.includes("schema cache")) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await supabase.from("water_disinfectant_logs").select("id").limit(1);
      error = await attemptInsert();
    }

    return error;
  };

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

  // Water usage chart with dynamic date range
  const usageChart = useMemo(() => {
    const startDate = filterStartDate ?? startOfMonth(new Date());
    const endDate = filterEndDate ?? new Date();
    const rangeStart = startOfDay(startDate);
    const rangeEnd = endOfDay(endDate);
    const days: Record<string, number> = {};
    for (let time = rangeStart.getTime(); time <= rangeEnd.getTime(); time += 86400000) {
      const date = format(new Date(time), "yyyy-MM-dd");
      days[date] = 0;
    }
    meterRecords.forEach((r: any) => {
      const recordDate = r.record_date;
      const recordTime = new Date(recordDate);
      if (recordTime >= rangeStart && recordTime <= rangeEnd && days[recordDate] !== undefined) {
        days[recordDate] += Number(r.usage_amount || 0);
      }
    });
    return Object.entries(days).map(([date, usage]) => ({
      date: format(new Date(date), "d MMM", { locale: th }),
      usage: Number(usage.toFixed(0)),
    }));
  }, [meterRecords, filterStartDate, filterEndDate]);

  // Grouped meter records for inline table
  const groupedMeter = useMemo(() => {
    const map: Record<string, any[]> = {};
    meterRecords.forEach((r: any) => {
      if (!map[r.record_date]) map[r.record_date] = [];
      map[r.record_date].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [meterRecords]);

  const filteredDisinfectantLogs = useMemo(() => {
    return disinfectantLogs.filter((r: any) => {
      if (filterStartDate && new Date(r.check_date) < startOfDay(filterStartDate)) return false;
      if (filterEndDate && new Date(r.check_date) > new Date(startOfDay(filterEndDate).getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [disinfectantLogs, filterStartDate, filterEndDate]);

  const groupedDisinfectantLogs = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredDisinfectantLogs.forEach((r: any) => {
      if (!map[r.check_date]) map[r.check_date] = [];
      map[r.check_date].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredDisinfectantLogs]);

  // Filter meter records by date range
  const filteredMeterRecords = useMemo(() => {
    return meterRecords.filter((r: any) => {
      if (filterStartDate && new Date(r.record_date) < startOfDay(filterStartDate)) return false;
      if (filterEndDate && new Date(r.record_date) > new Date(startOfDay(filterEndDate).getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [meterRecords, filterStartDate, filterEndDate]);

  // Grouped filtered meter records
  const groupedFilteredMeter = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredMeterRecords.forEach((r: any) => {
      if (!map[r.record_date]) map[r.record_date] = [];
      map[r.record_date].push(r);
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredMeterRecords]);

  const meterSummary = useMemo(() => {
    const map: Record<string, { totalUsage: number; records: number }> = {};
    filteredMeterRecords.forEach((r: any) => {
      const date = r.record_date;
      if (!map[date]) map[date] = { totalUsage: 0, records: 0 };
      map[date].totalUsage += Number(r.usage_amount || 0);
      map[date].records += 1;
    });
    const dates = Object.keys(map).sort((a, b) => b.localeCompare(a));
    const totalUsage = Object.values(map).reduce((sum, item) => sum + item.totalUsage, 0);
    return {
      totalDays: dates.length,
      totalUsage,
      averageUsage: dates.length > 0 ? Number((totalUsage / dates.length).toFixed(2)) : 0,
    };
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

  const handleExportDisinfectantRecords = () => {
    if (filteredDisinfectantLogs.length === 0) {
      toast.error("ไม่มีข้อมูลการบันทึกสารเคมีกำจัดเชื้อโรคในช่วงวันที่ที่เลือก");
      return;
    }
    exportToExcel(filteredDisinfectantLogs.map((l: any) => ({
      "วันที่": format(new Date(l.check_date), "d MMM yyyy", { locale: th }),
      "เวลา": l.check_time?.substring(0, 5) || "-",
      "สารเคมี": l.disinfectant_name || "-",
      "ความเข้มข้นต้นทาง (mg/l)": l.source_concentration ?? "-",
      "pH ต้นทาง": l.source_ph ?? "-",
      "ความเข้มข้นปลายทาง (mg/l)": l.outlet_concentration ?? "-",
      "pH ปลายทาง": l.outlet_ph ?? "-",
      "ผู้บันทึก": l.inspector_name || "-",
      "หมายเหตุ": l.notes || "-",
      "สถานะ": l.status === "pass" ? "ผ่าน" : "ไม่ผ่าน",
    })), "water-disinfectant-records", "สารเคมีฆ่าเชื้อ");
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

  const addDisinfectantLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      if (!disinfectantForm.source_concentration || !disinfectantForm.source_ph || !disinfectantForm.outlet_concentration || !disinfectantForm.outlet_ph) throw new Error("กรุณากรอกค่าต้นทางและปลายทางให้ครบ");
      const now = new Date();
      const checkDate = format(now, "yyyy-MM-dd");
      const checkTime = format(now, "HH:mm:ss");
      const sourceConcentration = Number(disinfectantForm.source_concentration);
      const sourcePh = Number(disinfectantForm.source_ph);
      const outletConcentration = Number(disinfectantForm.outlet_concentration);
      const outletPh = Number(disinfectantForm.outlet_ph);
      const passSource = sourceConcentration >= 0.2 && sourceConcentration <= 0.5 && sourcePh >= 6.5 && sourcePh <= 8.5;
      const passOutlet = outletConcentration >= 0.2 && outletConcentration <= 0.5 && outletPh >= 6.5 && outletPh <= 8.5;
      const status = passSource && passOutlet ? "pass" : "fail";
      const error = await safeInsertDisinfectant({
        check_date: checkDate,
        check_time: checkTime,
        disinfectant_name: "คลอรีน",
        source_concentration: sourceConcentration,
        source_ph: sourcePh,
        outlet_concentration: outletConcentration,
        outlet_ph: outletPh,
        inspector_id: user.id,
        inspector_name: profile?.full_name || "",
        notes: disinfectantForm.notes || null,
        status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกสารเคมีกำจัดเชื้อโรคสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-disinfectant-logs"] });
      setShowDisinfectantDialog(false);
      setDisinfectantForm({ disinfectant_name: "คลอรีน", source_concentration: "", source_ph: "", outlet_concentration: "", outlet_ph: "", notes: "" });
    },
    onError: (e: any) => {
      toast.error(e.message || "เกิดข้อผิดพลาดขณะบันทึกข้อมูล");
    },
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
        recorder_name: profile?.full_name || "",
      notes: meterNotes.length > 0 ? [
        ...meterNotes.filter((note) => note !== "อื่นๆ(ระบุ)"),
        meterNotes.includes("อื่นๆ(ระบุ)") && meterNotesOther ? `อื่นๆ: ${meterNotesOther}` : null,
      ].filter(Boolean).join(", ") : null,
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
      setMeterNotes([]);
      setMeterNotesOther("");
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

<<<<<<< HEAD
      {/* Water Meter Button - TOP on mobile */}
      <Card className="bg-gradient-to-br from-blue-600 via-cyan-500 to-teal-500 rounded-3xl shadow-2xl hover:shadow-3xl border-0 cursor-pointer transition-all active:scale-[0.96] ring-1 ring-blue-400/50 animate-pulse-subtle overflow-hidden" onClick={() => setShowMeterDialog(true)}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20 backdrop-blur-sm" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full -ml-16 -mb-16 backdrop-blur-sm" />
        <CardContent className="p-6 md:p-8 flex items-center gap-5 relative z-10">
          <div className="w-16 h-16 md:w-18 md:h-18 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg hover:bg-white/30 transition-all">
            <Plus className="h-8 w-8 md:h-9 md:w-9 text-white font-bold" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg md:text-xl font-extrabold text-white drop-shadow-sm">📝 บันทึกมิเตอร์น้ำออก</p>
            <p className="text-sm md:text-base text-white/90 truncate drop-shadow-sm font-medium">กดเพื่อบันทึกค่ามิเตอร์ทันที</p>
          </div>
        </CardContent>
      </Card>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-3xl shadow-lg hover:shadow-xl border-l-4 border-l-blue-500 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/15 rounded-full -mr-8 -mt-8" />
          <CardContent className="p-3 md:p-5 text-center relative z-10">
            <Droplets className="h-6 w-6 md:h-7 md:w-7 text-blue-600 mx-auto mb-1.5" />
            <p className="text-2xl md:text-3xl font-extrabold text-blue-700">{waterLevel}%</p>
            <p className="text-[10px] md:text-xs text-slate-600 font-medium mt-1">ระดับน้ำสำรอง</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-3xl shadow-lg hover:shadow-xl border-l-4 border-l-teal-500 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/15 rounded-full -mr-8 -mt-8" />
          <CardContent className="p-3 md:p-5 text-center relative z-10">
            <Gauge className="h-6 w-6 md:h-7 md:w-7 text-teal-600 mx-auto mb-1.5" />
            <p className="text-2xl md:text-3xl font-extrabold text-teal-700">{avgChlorine ?? "-"}</p>
            <p className="text-[10px] md:text-xs text-slate-600 font-medium">คลอรีน (mg/l)</p>
            <p className="text-[9px] md:text-[10px] text-slate-600 font-medium">เป้าหมาย 0.2-0.5</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-3xl shadow-lg hover:shadow-xl border-l-4 border-l-emerald-500 transition-all duration-300 overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-white/15 rounded-full -mr-8 -mt-8" />
          <CardContent className="p-3 md:p-5 text-center relative z-10">
            <AlertTriangle className="h-6 w-6 md:h-7 md:w-7 text-emerald-600 mx-auto mb-1.5" />
            <p className="text-2xl md:text-3xl font-extrabold text-emerald-700">{normalPoints.normal}/{normalPoints.total}</p>
            <p className="text-[10px] md:text-xs text-slate-600 font-medium mt-1">จุดน้ำไหลปกติ</p>
=======
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
        <Card className="bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-3xl shadow-2xl border-0 border-b-4 border-b-blue-800 cursor-pointer hover:shadow-3xl transition-all active:scale-95 ring-2 ring-blue-300/50 animate-pulse-subtle" onClick={() => setShowMeterDialog(true)}>
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-20 h-20 md:w-16 md:h-16 rounded-3xl bg-white/30 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg border border-white/40">
              <Plus className="h-9 w-9 md:h-8 md:w-8 text-white font-bold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl md:text-2xl font-black text-white drop-shadow-md">📝 บันทึกมิเตอร์น้ำออก</p>
              <p className="text-sm md:text-base text-white/90 truncate drop-shadow-sm">กดเพื่อบันทึกค่ามิเตอร์ทันที</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-600 via-amber-400 to-yellow-500 rounded-3xl shadow-2xl border-0 border-b-4 border-b-amber-800 cursor-pointer hover:shadow-3xl transition-all active:scale-95 ring-2 ring-amber-300/50 animate-pulse-subtle" onClick={() => setShowDisinfectantDialog(true)}>
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-20 h-20 md:w-16 md:h-16 rounded-3xl bg-white/30 backdrop-blur-md flex items-center justify-center flex-shrink-0 shadow-lg border border-white/40">
              <Plus className="h-9 w-9 md:h-8 md:w-8 text-white font-bold" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xl md:text-2xl font-black text-white drop-shadow-md">🧪 บันทึกปริมาณสารเคมีกำจัดเชื้อโรค</p>
              <p className="text-sm md:text-base text-white/90 truncate drop-shadow-sm">กดเพื่อบันทึกผลตรวจสารฆ่าเชื้อในน้ำประปา</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl shadow-2xl border-0 border-t-4 border-t-blue-600 hover:shadow-3xl transition-shadow">
          <CardContent className="p-4 md:p-5 text-center">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Droplets className="h-6 w-6 md:h-7 md:w-7 text-white" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-blue-700">{waterLevel}%</p>
            <p className="text-[10px] md:text-xs text-blue-600 font-semibold">ระดับน้ำสำรอง</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl shadow-2xl border-0 border-t-4 border-t-teal-600 hover:shadow-3xl transition-shadow">
          <CardContent className="p-4 md:p-5 text-center">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-teal-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Gauge className="h-6 w-6 md:h-7 md:w-7 text-white" />
            </div>
            <p className="text-2xl md:text-3xl font-black text-teal-700">{avgChlorine ?? "-"}</p>
            <p className="text-[10px] md:text-xs text-teal-600 font-semibold">คลอรีน (mg/l)</p>
            <p className="text-[9px] md:text-[10px] text-teal-500 font-medium">เป้าหมาย 0.2-0.5</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl shadow-2xl border-0 border-t-4 border-t-emerald-600 hover:shadow-3xl transition-shadow">
          <CardContent className="p-4 md:p-5 text-center">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <AlertTriangle className="h-6 w-6 md:h-7 md:w-7 text-white" />
            <p className="text-xl md:text-2xl font-extrabold text-emerald-600">{normalPoints.normal}/{normalPoints.total}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">จุดน้ำไหลปกติ</p>
>>>>>>> 7ae2e01dcbc80077dbfadb160488f6c9b512c270
          </CardContent>
        </Card>
      </div>

      {/* Tabs: คุณภาพน้ำ / ระบบ / บำรุงรักษา */}
      <Tabs defaultValue="quality" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto rounded-2xl bg-white shadow-sm p-1 gap-1">
          <TabsTrigger value="quality" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white">
            <Droplets className="h-4 w-4 mr-1" /> คุณภาพน้ำ
          </TabsTrigger>
          <TabsTrigger value="meter" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
            <Gauge className="h-4 w-4 mr-1" /> ประวัติการบันทึก
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-cyan-500 data-[state=active]:text-white">
            <Settings className="h-4 w-4 mr-1" /> บริหารระบบ
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="rounded-xl text-xs md:text-sm py-2 data-[state=active]:bg-amber-500 data-[state=active]:text-white">
            <Wrench className="h-4 w-4 mr-1" /> บำรุงรักษา
          </TabsTrigger>
        </TabsList>

        <TabsContent value="system" className="mt-4">
          <WaterSystemTab />
        </TabsContent>

        <TabsContent value="maintenance" className="mt-4">
          <WaterMaintenanceTab />
        </TabsContent>

        <TabsContent value="meter" className="mt-4">
          <div className="space-y-4">
            {/* Date Range Filter */}
            <Card className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl shadow-2xl border border-slate-200/80 ring-1 ring-slate-200/70">
              <CardContent className="p-5 md:p-6">
                <div className="grid gap-4 xl:grid-cols-[1.2fr_auto] xl:items-end">
                  <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                    <div className="rounded-[32px] bg-white shadow-sm border border-slate-200 p-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">กรองวันที่</p>
                      <div className="mt-3 flex flex-col gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("text-sm h-10 rounded-2xl justify-start", !filterStartDate && "text-slate-400")}> 
                              {filterStartDate ? format(filterStartDate, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={filterStartDate} onSelect={setFilterStartDate} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" size="sm" className={cn("text-sm h-10 rounded-2xl justify-start", !filterEndDate && "text-slate-400")}> 
                              {filterEndDate ? format(filterEndDate, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={filterEndDate} onSelect={setFilterEndDate} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>

                    <div className="rounded-[32px] bg-white shadow-sm border border-slate-200 p-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">สรุปข้อมูล</p>
                      <p className="mt-3 text-3xl font-black text-cyan-700">{meterSummary.totalUsage.toLocaleString()}</p>
                      <p className="mt-1 text-sm text-slate-600">รวมลบ.ม.</p>
                    </div>

                    <div className="rounded-[32px] bg-white shadow-sm border border-slate-200 p-4">
                      <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">เฉลี่ยต่อวัน</p>
                      <p className="mt-3 text-3xl font-black text-slate-900">{meterSummary.averageUsage.toLocaleString()}</p>
                      <p className="mt-1 text-sm text-slate-600">ลบ.ม./วัน</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <Button size="sm" className="rounded-2xl bg-blue-600 hover:bg-blue-700 text-white" onClick={() => { setMeterContentTab("meter"); }}>
                      ประวัติมิเตอร์
                    </Button>
                    <Button size="sm" className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-black" onClick={() => { setMeterContentTab("disinfectant"); }}>
                      ประวัติสารเคมี
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {meterContentTab === "meter" && usageChart.length > 0 && (
              <Card className="bg-white rounded-3xl shadow-elevated border border-slate-200">
                <CardContent className="p-4">
                  <div>
                    <p className="mb-4 text-sm font-semibold text-slate-900">📊 กราฟการใช้น้ำประปา</p>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={usageChart}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: "12px" }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: "12px" }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "16px" }}
                          formatter={(value) => `${value.toLocaleString()} ลบ.ม.`}
                          labelFormatter={(label) => `วัน: ${label}`}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="usage" 
                          stroke="#06b6d4" 
                          strokeWidth={3}
                          dot={{ fill: "#06b6d4", r: 5 }}
                          activeDot={{ r: 8 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="bg-white rounded-3xl shadow-elevated border border-slate-200">
              <CardContent className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{meterContentTab === "meter" ? "ประวัติมิเตอร์น้ำ" : "ประวัติสารเคมีกำจัดเชื้อโรค"}</p>
                    <p className="text-xs text-slate-500">แสดงข้อมูลแบบตารางที่อ่านง่ายสำหรับผู้ใช้</p>
                  </div>
                  <Button size="sm" className="rounded-2xl bg-slate-950 hover:bg-slate-900 text-white gap-2" onClick={meterContentTab === "meter" ? handleExportMeterRecords : handleExportDisinfectantRecords}>
                    <Download className="h-4 w-4" /> ส่งออก Excel
                  </Button>
                </div>

                <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-200 bg-slate-50">
                  {meterContentTab === "meter" ? (
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-white">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">วันที่</th>
                          <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">เวลา</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">มิเตอร์</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">การใช้</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">รวมต่อวัน</th>
                          <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">ผู้บันทึก</th>
                          <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {groupedFilteredMeter.map(([date, dateRecords]) => {
                          const sortedRecords = [...dateRecords].sort((a: any, b: any) => a.record_time.localeCompare(b.record_time));
                          return (
                            sortedRecords.map((r: any, i: number) => (
                              <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                                {i === 0 ? (
                                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                    {format(new Date(date), "d MMM yy", { locale: th })}
                                  </td>
                                ) : (
                                  <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                    {format(new Date(date), "d MMM yy", { locale: th })}
                                  </td>
                                )}
                                <td className="px-4 py-3 text-center text-xs text-slate-600">{r.record_time?.substring(0, 5)}</td>
                                <td className="px-4 py-3 text-right text-xs font-semibold text-slate-900">{Number(r.meter_reading).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-xs text-slate-700">{Number(r.usage_amount || 0).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right text-xs text-cyan-700 font-bold">{r.daily_total != null ? Number(r.daily_total).toLocaleString() : "-"}</td>
                                <td className="px-4 py-3 text-center text-xs text-slate-600">{r.recorder_name || "-"}</td>
                                <td className="px-4 py-3 text-xs text-slate-600">{r.notes || "-"}</td>
                              </tr>
                            ))
                          );
                        })}
                        {filteredMeterRecords.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</td></tr>
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                      <thead className="bg-white">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">วันที่</th>
                          <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">เวลา</th>
                          <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">สารเคมี</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">ต้นทาง (mg/l)</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">pH ต้นทาง</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">ปลายทาง (mg/l)</th>
                          <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">pH ปลายทาง</th>
                          <th className="whitespace-nowrap px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">ผู้บันทึก</th>
                          <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-500">หมายเหตุ</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {groupedDisinfectantLogs.map(([date, dateRecords]) =>
                          dateRecords.sort((a: any, b: any) => a.check_time.localeCompare(b.check_time)).map((r: any, i: number) => (
                            <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                                {format(new Date(date), "d MMM yy", { locale: th })}
                              </td>
                              <td className="px-4 py-3 text-center text-xs text-slate-600">{r.check_time?.substring(0, 5)}</td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-900">{r.disinfectant_name || "-"}</td>
                              <td className="px-4 py-3 text-right text-xs text-slate-700">{r.source_concentration ?? "-"}</td>
                              <td className="px-4 py-3 text-right text-xs text-slate-700">{r.source_ph ?? "-"}</td>
                              <td className="px-4 py-3 text-right text-xs text-slate-700">{r.outlet_concentration ?? "-"}</td>
                              <td className="px-4 py-3 text-right text-xs text-slate-700">{r.outlet_ph ?? "-"}</td>
                              <td className="px-4 py-3 text-center text-xs text-slate-600">{r.inspector_name || "-"}</td>
                              <td className="px-4 py-3 text-xs text-slate-600">{r.notes || "-"}</td>
                            </tr>
                          ))
                        )}
                        {filteredDisinfectantLogs.length === 0 && (
                          <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">ยังไม่มีข้อมูล</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="quality" className="mt-4">
          <div className="space-y-4">
            {/* Water Quality Batch Form */}
            <WaterQualityBatchForm />
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-12 w-full justify-between rounded-2xl text-left", meterNotes.length === 0 && "text-slate-500")}> 
                    <span className="truncate">
                      {meterNotes.length > 0 ? meterNotes.join(", ") : "เลือกหมายเหตุ"}
                    </span>
                    <span className="text-xs text-muted-foreground">▼</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-3">
                  <div className="space-y-2">
                    {METER_NOTE_OPTIONS.map((option) => {
                      const checked = meterNotes.includes(option);
                      return (
                        <label key={option} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 hover:bg-slate-50">
                          <Checkbox checked={checked} onCheckedChange={(value) => {
                            if (value === true) {
                              setMeterNotes((current) => Array.from(new Set([...current, option])));
                            } else {
                              setMeterNotes((current) => current.filter((item) => item !== option));
                            }
                          }} />
                          <span className="text-sm text-slate-700">{option}</span>
                        </label>
                      );
                    })}
                    {meterNotes.includes("อื่นๆ(ระบุ)") && (
                      <Input
                        value={meterNotesOther}
                        onChange={(e) => setMeterNotesOther(e.target.value)}
                        placeholder="ระบุรายละเอียดอื่นๆ"
                        className="h-11 rounded-2xl"
                      />
                    )}
                  </div>
                </PopoverContent>
              </Popover>
              {meterNotes.includes("อื่นๆ(ระบุ)") && meterNotesOther && (
                <p className="mt-2 text-xs text-slate-500">ระบุเพิ่มเติม: {meterNotesOther}</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">💡 ระบบจะคำนวณ "จำนวนน้ำที่ใช้ไป" อัตโนมัติจากเลขมิเตอร์ครั้งก่อนหน้า</p>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addMeterRecord.mutate()} disabled={addMeterRecord.isPending || !meterReading}>
              {addMeterRecord.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDisinfectantDialog} onOpenChange={setShowDisinfectantDialog}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Droplets className="h-5 w-5 text-amber-500" /> บันทึกสารเคมีกำจัดเชื้อโรค
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-amber-50 p-3 space-y-1 text-sm">
              <p><span className="font-semibold">วันที่:</span> {now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p><span className="font-semibold">เวลา:</span> {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
              <p><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
            </div>
            <div>
              <Label className="font-semibold">ชื่อสารเคมี</Label>
              <Input type="text" value="คลอรีน" readOnly className="h-12 rounded-2xl bg-slate-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="font-semibold">ความเข้มข้นต้นทาง (mg/l) *</Label>
                <Input type="number" step="0.01" value={disinfectantForm.source_concentration} onChange={(e) => setDisinfectantForm({ ...disinfectantForm, source_concentration: e.target.value })} placeholder="0.30" className="h-12 rounded-2xl" />
              </div>
              <div>
                <Label className="font-semibold">pH ต้นทาง *</Label>
                <Input type="number" step="0.1" value={disinfectantForm.source_ph} onChange={(e) => setDisinfectantForm({ ...disinfectantForm, source_ph: e.target.value })} placeholder="7.0" className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="font-semibold">ความเข้มข้นปลายทาง (mg/l) *</Label>
                <Input type="number" step="0.01" value={disinfectantForm.outlet_concentration} onChange={(e) => setDisinfectantForm({ ...disinfectantForm, outlet_concentration: e.target.value })} placeholder="0.30" className="h-12 rounded-2xl" />
              </div>
              <div>
                <Label className="font-semibold">pH ปลายทาง *</Label>
                <Input type="number" step="0.1" value={disinfectantForm.outlet_ph} onChange={(e) => setDisinfectantForm({ ...disinfectantForm, outlet_ph: e.target.value })} placeholder="7.0" className="h-12 rounded-2xl" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 text-xs text-slate-600 space-y-1">
              <p>💡 เกณฑ์มาตรฐาน:</p>
              <p>• ความเข้มข้นคลอรีน 0.2 - 0.5 mg/l</p>
              <p>• pH 6.5 - 8.5</p>
            </div>
            <div>
              <Label className="font-semibold">หมายเหตุ</Label>
              <Textarea value={disinfectantForm.notes} onChange={(e) => setDisinfectantForm({ ...disinfectantForm, notes: e.target.value })} placeholder="บันทึกข้อมูลเพิ่มเติม..." rows={2} className="rounded-2xl" />
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold bg-amber-500 text-black hover:bg-amber-600" onClick={() => addDisinfectantLog.mutate()} disabled={addDisinfectantLog.isPending || !disinfectantForm.source_concentration || !disinfectantForm.source_ph || !disinfectantForm.outlet_concentration || !disinfectantForm.outlet_ph}>
              {addDisinfectantLog.isPending ? "กำลังบันทึก..." : "บันทึกสารเคมี"}
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
