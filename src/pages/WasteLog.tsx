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
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

interface WasteSettings {
  infectious_carrier_cost: number;
}

const defaultWasteSettings: WasteSettings = {
  infectious_carrier_cost: 40,
};

export default function WasteLog() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  
  const [wasteType, setWasteType] = useState("");
  const [weight, setWeight] = useState("");
  const [collectedAt, setCollectedAt] = useState<Date>(new Date());
  const [carrierName, setCarrierName] = useState("");
  const [manifestNo, setManifestNo] = useState("");
  const [cost, setCost] = useState("");
  
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<WasteSettings>({ ...defaultWasteSettings });

  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>({
    general: { label: "ขยะทั่วไป", color: "bg-blue-100 text-blue-800 border-blue-200", chartColor: "hsl(215 25% 65%)" },
    recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-100 text-emerald-800 border-emerald-200", chartColor: "hsl(145 25% 60%)" },
    infectious: { label: "ขยะติดเชื้อ", color: "bg-rose-100 text-rose-800 border-rose-200", chartColor: "hsl(355 25% 65%)" },
    hazardous: { label: "ขยะอันตราย", color: "bg-amber-100 text-amber-800 border-amber-200", chartColor: "hsl(35 25% 60%)" },
  });

  const { data: dbSettings } = useQuery({
    queryKey: ["waste-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("value").eq("key", "waste_management_settings").maybeSingle();
      if (error) return null;
      return data?.value as unknown as WasteSettings | null;
    },
  });

  useEffect(() => {
    if (dbSettings) {
      setSettings(dbSettings);
    }
  }, [dbSettings]);

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").upsert({
        key: "waste_management_settings",
        value: settings as any,
        updated_by: user?.id,
      }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าสำเร็จ");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["waste-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: logs } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .order("collected_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (editingLog) {
      setWasteType(editingLog.waste_type);
      setWeight(editingLog.weight_kg.toString());
      setCollectedAt(new Date(editingLog.collected_at));
      setCarrierName(editingLog.carrier_name || "");
      setManifestNo(editingLog.manifest_no || "");
      setCost(editingLog.cost_thb ? editingLog.cost_thb.toString() : "");
      setShowForm(true);
    } else {
      resetForm();
    }
  }, [editingLog]);

  useEffect(() => {
    if (wasteType === "infectious" && !cost && weight) {
      const w = parseFloat(weight);
      if (!isNaN(w)) {
        setCost((w * settings.infectious_carrier_cost).toFixed(2));
      }
    }
  }, [wasteType, weight, settings.infectious_carrier_cost]);

  const resetForm = () => {
    setWasteType("");
    setWeight("");
    setCollectedAt(new Date());
    setCarrierName("");
    setManifestNo("");
    setCost("");
    setEditingLog(null);
  };

  const logMutation = useMutation({
    mutationFn: async () => {
      if (!wasteType || !weight) throw new Error("กรุณากรอกข้อมูลที่จำเป็น");
      const payload = {
        waste_type: wasteType,
        weight_kg: parseFloat(weight),
        collected_at: collectedAt.toISOString(),
        carrier_name: wasteType === "infectious" ? carrierName : null,
        manifest_no: wasteType === "infectious" ? manifestNo : null,
        cost_thb: cost ? parseFloat(cost) : null,
        recorded_by: user?.id,
        department_id: profile?.department_id,
      };

      if (editingLog) {
        const { error } = await supabase.from("waste_logs").update(payload).eq("id", editingLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("waste_logs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingLog ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกข้อมูลสำเร็จ");
      setShowForm(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบข้อมูลสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // กรองข้อมูลตามระยะเวลาที่เลือก
  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    return logs.filter((log) => {
      const date = new Date(log.collected_at);
      const now = new Date();
      if (filterPeriod === "day" && date < startOfDay(now)) return false;
      if (filterPeriod === "week" && date < startOfWeek(now, { weekStartsOn: 1 })) return false;
      if (filterPeriod === "month" && date < startOfMonth(now)) return false;
      if (filterPeriod === "custom" && customFrom && customTo) {
        if (date < startOfDay(customFrom) || date > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
      }
      return true;
    });
  }, [logs, filterPeriod, customFrom, customTo]);

  // 💡 แก้ไข: บังคับให้ประวัติขยะติดเชื้อทำการเรียงลำดับตามวันที่รับขยะ (collected_at) จากใหม่ไปเก่าเสมอก่อนแสดงผลในตาราง
  const sortedInfectiousLogs = useMemo(() => {
    return filteredLogs
      .filter((log) => log.waste_type === "infectious")
      .sort((a, b) => new Date(b.collected_at).getTime() - new Date(a.collected_at).getTime());
  }, [filteredLogs]);

  const stats = useMemo(() => {
    const totalWeight = filteredLogs.reduce((acc, log) => acc + log.weight_kg, 0);
    const totalCost = filteredLogs.reduce((acc, log) => acc + (log.cost_thb || 0), 0);
    
    const byType = filteredLogs.reduce((acc, log) => {
      if (!acc[log.waste_type]) acc[log.waste_type] = { weight: 0, cost: 0, count: 0 };
      acc[log.waste_type].weight += log.weight_kg;
      acc[log.waste_type].cost += (log.cost_thb || 0);
      acc[log.waste_type].count += 1;
      return acc;
    }, {} as Record<string, { weight: number; cost: number; count: number }>);

    return { totalWeight, totalCost, byType };
  }, [filteredLogs]);

  const chartData = useMemo(() => {
    const daily: Record<string, Record<string, number>> = {};
    filteredLogs.forEach((log) => {
      const dayStr = format(new Date(log.collected_at), "d MMM", { locale: th });
      if (!daily[dayStr]) daily[dayStr] = {};
      daily[dayStr][log.waste_type] = (daily[dayStr][log.waste_type] || 0) + log.weight_kg;
    });
    return Object.entries(daily).map(([name, values]) => ({ name, ...values })).reverse();
  }, [filteredLogs]);

  const pieData = useMemo(() => {
    return Object.entries(stats.byType).map(([key, value]) => ({
      name: typesMap[key]?.label || key,
      value: value.weight,
      color: typesMap[key]?.chartColor || "#cbd5e1",
    }));
  }, [stats.byType, typesMap]);

  const exportExcel = () => {
    const data = sortedInfectiousLogs.map((log) => ({
      "วันที่รับขยะ": format(new Date(log.collected_at), "d MMMM yyyy HH:mm", { locale: th }),
      "ประเภทขยะ": typesMap[log.waste_type]?.label || log.waste_type,
      "น้ำหนัก (กก.)": log.weight_kg,
      "บริษัทที่ขนส่ง": log.carrier_name || "-",
      "เลขที่ใบกำกับการขนส่ง": log.manifest_no || "-",
      "ค่ากำจัด (บาท)": log.cost_thb || 0,
      "วันที่บันทึก": format(new Date(log.created_at), "d MMM yy HH:mm", { locale: th }),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Waste Logs");
    XLSX.writeFile(wb, `waste-log-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("ส่งออกไฟล์ Excel สำเร็จ");
  };

  return (
    <div className="w-full max-w-none px-2 md:px-6 space-y-4 pb-10">
      <PageHeader title="ระบบจัดการขยะ" subtitle="บันทึกข้อมูล ปริมาณขยะ และขยะติดเชื้อ">
        <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs gap-1" onClick={() => setSettingsOpen(true)}>⚙️ ตั้งค่า</Button>
        <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs gap-1 border-emerald-200 text-emerald-700" onClick={exportExcel}><Download className="h-3.5 w-3.5" /> Excel</Button>
        <Button size="sm" className="h-9 rounded-2xl text-xs" onClick={() => { setEditingLog(null); setShowForm(!showForm); }}>{showForm ? "ซ่อนฟอร์ม" : "+ บันทึกขยะ"}</Button>
      </PageHeader>

      <Card className="border border-border/50 shadow-card rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="h-10 text-sm w-36 rounded-2xl"><SelectValue placeholder="เลือกช่วงเวลา" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="day">วันนี้</SelectItem>
                <SelectItem value="week">สัปดาห์นี้</SelectItem>
                <SelectItem value="month">เดือนนี้</SelectItem>
                <SelectItem value="custom">เลือกวันที่</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterPeriod === "custom" && (
            <div className="flex flex-wrap gap-2 animate-fade-in">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-sm h-10 w-44 justify-start rounded-2xl", !customFrom && "text-slate-500")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customFrom ? format(customFrom, "d MMM yyyy", { locale: th }) : "วันเริ่มต้น"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-sm h-10 w-44 justify-start rounded-2xl", !customTo && "text-slate-500")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {customTo ? format(customTo, "d MMM yyyy", { locale: th }) : "วันสิ้นสุด"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)} initialFocus className="p-3 pointer-events-
