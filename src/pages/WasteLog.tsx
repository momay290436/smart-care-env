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

interface WasteTypeConfig {
  label: string;
  color: string;
  chartColor: string;
}

const DEFAULT_TYPES_MAP: Record<string, WasteTypeConfig> = {
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-100 text-red-800 border-red-200", chartColor: "hsl(0 84.2% 60.2%)" },
  general: { label: "ขยะทั่วไป", color: "bg-blue-100 text-blue-800 border-blue-200", chartColor: "hsl(221.2 83.2% 53.3%)" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-green-100 text-green-800 border-green-200", chartColor: "hsl(142.1 76.2% 36.3%)" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-100 text-amber-800 border-amber-200", chartColor: "hsl(35.3 91.7% 32.9%)" },
};

export default function WasteLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("infectious");
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [note, setNote] = useState("");

  // Settings states
  const [typesMap, setTypesMap] = useState<Record<string, WasteTypeConfig>>(DEFAULT_TYPES_MAP);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  // Filter states
  const [filterSource, setFilterSource] = useState("all");
  const [timeRange, setTimeRange] = useState("all");

  // Fetch settings
  const { data: settingsData } = useQuery({
    queryKey: ["wasteSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_settings")
        .select("value")
        .eq("key", "waste_types_config")
        .maybeSingle();
      if (error) throw error;
      return data?.value as Record<string, WasteTypeConfig> | null;
    }
  });

  useEffect(() => {
    if (settingsData) {
      setTypesMap(settingsData);
    }
  }, [settingsData]);

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hospital_settings")
        .upsert({ key: "waste_types_config", value: typesMap }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าประเภทขยะสำเร็จ");
      setIsSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wasteSettings"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("ไม่สามารถบันทึกการตั้งค่าได้");
    }
  });

  // Fetch logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["wasteLogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .order("collected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uniqueSources = useMemo(() => {
    const sources = new Set(logs.map(log => log.source_name).filter(Boolean));
    return ["all", ...Array.from(sources)];
  }, [logs]);

  // Filter logs based on active tab and filters
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (log.waste_type !== activeTab) return false;
      if (filterSource !== "all" && log.source_name !== filterSource) return false;
      
      if (timeRange !== "all") {
        const logDate = new Date(log.collected_at);
        const now = new Date();
        if (timeRange === "today" && logDate < startOfDay(now)) return false;
        if (timeRange === "week" && logDate < startOfWeek(now)) return false;
        if (timeRange === "month" && logDate < startOfMonth(now)) return false;
      }
      
      return true;
    });
  }, [logs, activeTab, filterSource, timeRange]);

  // สถิติสำหรับกราฟและสรุปยอด
  const stats = useMemo(() => {
    const activeLogs = logs.filter(log => log.waste_type === activeTab);
    const total = activeLogs.reduce((sum, log) => sum + Number(log.weight), 0);
    const count = activeLogs.length;
    const avg = count > 0 ? total / count : 0;

    // ข้อมูลรายวันย้อนหลังสำหรับกราฟเส้น
    const dailyData: Record<string, number> = {};
    activeLogs.slice(0, 30).forEach((log) => {
      const dateStr = format(new Date(log.collected_at), "d MMM", { locale: th });
      dailyData[dateStr] = (dailyData[dateStr] || 0) + Number(log.weight);
    });
    const chartData = Object.entries(dailyData).map(([name, weight]) => ({ name, weight })).reverse();

    // ข้อมูลแยกตามแหล่งที่มาสำหรับกราฟวงกลม
    const sourceData: Record<string, number> = {};
    activeLogs.forEach((log) => {
      const source = log.source_name || "ไม่ระบุ";
      sourceData[source] = (sourceData[source] || 0) + Number(log.weight);
    });
    const pieData = Object.entries(sourceData).map(([name, value]) => ({ name, value }));

    return { total, count, avg, chartData, pieData };
  }, [logs, activeTab]);

  // มิวเทชันสำหรับเพิ่ม/แก้ไขข้อมูล
  const saveLog = useMutation({
    mutationFn: async () => {
      const payload = {
        waste_type: activeTab,
        weight: parseFloat(weight),
        source_name: sourceName.trim() || null,
        note: note.trim() || null,
        collected_at: selectedDate.toISOString(),
        recorder_id: user?.id,
      };

      if (editingId) {
        const { error } = await supabase
          .from("waste_logs")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("waste_logs").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกข้อมูลสำเร็จ");
      setIsOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["wasteLogs"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    },
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบข้อมูลเรียบร้อยแล้ว");
      queryClient.invalidateQueries({ queryKey: ["wasteLogs"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("ไม่สามารถลบข้อมูลได้");
    },
  });

  const handleEdit = (log: any) => {
    setEditingId(log.id);
    setWeight(log.weight.toString());
    setSourceName(log.source_name || "");
    setNote(log.note || "");
    setSelectedDate(new Date(log.collected_at));
    setIsOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setWeight("");
    setSourceName("");
    setNote("");
    setSelectedDate(new Date());
  };

  // ฟังก์ชัน Export แบบสร้างโครงสร้างไฟล์ที่ปลอดภัยที่สุด ไม่จำเป็นต้องใช้ Module เสริมภายนอก
  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออกในตารางนี้");
      return;
    }

    try {
      const headers = ["วันที่-เวลา", "แหล่งที่มา / แผนก", "ประเภทขยะ", "น้ำหนัก (กก.)", "หมายเหตุ"];
      let csvContent = "\uFEFF"; // ป้องกันภาษาไทยเพี้ยนใน Excel (BOM)

      // Sectionที่ 1: ตารางรวมทุกแหล่งที่มา
      csvContent += "=== รวมทุกแหล่งที่มา ===\n";
      csvContent += headers.join(",") + "\n";
      
      filteredLogs.forEach((log) => {
        const row = [
          `"${format(new Date(log.collected_at), 'dd MMM yyyy HH:mm', { locale: th })}"`,
          `"${log.source_name || 'ไม่ระบุ'}"`,
          `"${typesMap[log.waste_type]?.label || log.waste_type}"`,
          Number(log.weight),
          `"${log.note || '-'}"`
        ];
        csvContent += row.join(",") + "\n";
      });

      // Sectionที่ 2: วนลูปแยกกลุ่มตามสถานที่ให้อัตโนมัติ (แยกเป็นตารางย่อยๆ ลงไปในไฟล์เดียวกัน)
      const uniqueSources = Array.from(
        new Set(filteredLogs.map((log) => log.source_name).filter(Boolean))
      );

      uniqueSources.forEach((sourceName) => {
        csvContent += `\n\n=== แหล่งที่มา: ${sourceName} ===\n`;
        csvContent += headers.join(",") + "\n";

        const sourceLogs = filteredLogs.filter((log) => log.source_name === sourceName);
        sourceLogs.forEach((log) => {
          const row =
