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
import * as XLSX from 'xlsx';
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

  // Settings states - มั่นใจว่ามีค่า Default รองรับเสมอ
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

  // อัปเดตโครงสร้างเมื่อได้ข้อมูลจากหลังบ้าน หรือถ้าไม่มีให้ fallback กลับไปที่ตัวหลักเสมอ
  useEffect(() => {
    if (settingsData && Object.keys(settingsData).length > 0) {
      setTypesMap(settingsData);
    } else {
      setTypesMap(DEFAULT_TYPES_MAP);
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

    const dailyData: Record<string, number> = {};
    activeLogs.slice(0, 30).forEach((log) => {
      const dateStr = format(new Date(log.collected_at), "d MMM", { locale: th });
      dailyData[dateStr] = (dailyData[dateStr] || 0) + Number(log.weight);
    });
    const chartData = Object.entries(dailyData).map(([name, weight]) => ({ name, weight })).reverse();

    const sourceData: Record<string, number> = {};
    activeLogs.forEach((log) => {
      const source = log.source_name || "ไม่ระบุ";
      sourceData[source] = (sourceData[source] || 0) + Number(log.weight);
    });
    const pieData = Object.entries(sourceData).map(([name, value]) => ({ name, value }));

    return { total, count, avg, chartData, pieData };
  }, [logs, activeTab]);

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

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      toast.error("ไม่มีข้อมูลที่จะส่งออกในตารางนี้");
      return;
    }

    const formatItem = (item: any) => ({
      "วันที่-เวลาที่บันทึก": format(new Date(item.collected_at), "dd/MM/yyyy HH:mm", { locale: th }),
      "แหล่งที่มา / หน่วยงาน": item.source_name || "ไม่ระบุแหล่งที่มา",
      "ประเภทขยะ": typesMap[item.waste_type]?.label || item.waste_type,
      "น้ำหนักสุทธิ (กิโลกรัม)": Number(item.weight),
      "หมายเหตุเพิ่มเติม": item.note || "-"
    });

    const wb = XLSX.utils.book_new();
    const allFormattedData = filteredLogs.map(formatItem);
    const wsAll = XLSX.utils.json_to_sheet(allFormattedData);
    XLSX.utils.book_append_sheet(wb, wsAll, "รวมทุกแหล่งที่มา");

    const uniqueSourceNames = Array.from(
      new Set(filteredLogs.map((item: any) => item.source_name).filter(Boolean))
    );

    uniqueSourceNames.forEach((name: string) => {
      const targetSourceLogs = filteredLogs.filter((item: any) => item.source_name === name);
      const formattedSourceData = targetSourceLogs.map(formatItem);
      const wsSource = XLSX.utils.json_to_sheet(formattedSourceData);
      const safeSheetName = name.substring(0, 31);
      XLSX.utils.book_append_sheet(wb, wsSource, safeSheetName);
    });

    const currentTabLabel = typesMap[activeTab]?.label || "รายงานขยะ";
    const fileName = `รายงาน_${currentTabLabel}_แยกแหล่งที่มา_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
    toast.success("สร้างรายงานและเริ่มดาวน์โหลดไฟล์ Excel แยกแหล่งที่มาสำเร็จ");
  };

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

  return (
    <div className="container mx-auto px-4 py-8 space-y-8 animate-fade-in max-w-7xl">
      <PageHeader 
        title="ระบบจัดการและบันทึกข้อมูลขยะ" 
        description="บันทึกข้อมูล ปริมาณขยะ ติดตามสถิติ และออกรายงานแยกประเภท"
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-12 rounded-2xl border-slate-200" onClick={() => setIsSettingsOpen(true)}>
            ตั้งค่าประเภทขยะ
          </Button>
          <Button className="h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800" onClick={() => { resetForm(); setIsOpen(true); }}>
            <Plus className="mr-2 h-5 w-5" /> บันทึกปริมาณขยะ
          </Button>
        </div>
      </PageHeader>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full h-auto p-1 bg-slate-100 rounded-3xl grid grid-cols-2 md:flex md:flex-wrap gap-1">
          {Object.entries(typesMap).map(([key, config]) => (
            <TabsTrigger key={key} value={key} className="rounded-2xl py-3 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm md:flex-1">
              {config?.label || key}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.keys(typesMap).map((tabKey) => (
          <TabsContent key={tabKey} value={tabKey} className="space-y-6 mt-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="rounded-3xl border-none shadow-sm bg-white">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">น้ำหนักรวมทั้งหมด</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total.toLocaleString()} กก.</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-none shadow-sm bg-white">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">จำนวนครั้งที่บันทึก</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.count} ครั้ง</p>
                </CardContent>
              </Card>
              <Card className="rounded-3xl border-none shadow-sm bg-white">
                <CardContent className="p-6">
                  <p className="text-sm font-medium text-slate-500">ค่าเฉลี่ยต่อครั้ง</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2">{stats.avg.toFixed(2)} กก.</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">แนวโน้มปริมาณขยะ (30 วันล่าสุด)</h3>
                <div className="h-64">
                  {stats.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.chartData}>
                        <defs>
                          <linearGradient id="colorWeight" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={typesMap[activeTab]?.chartColor || "#8884d8"} stopOpacity={0.2}/>
                            <stop offset="95%" stopColor={typesMap[activeTab]?.chartColor || "#8884d8"} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#64748b" style={{ fontSize: 12 }} />
                        <YAxis tickLine={false} axisLine={false} stroke="#64748b" style={{ fontSize: 12 }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="weight" stroke={typesMap[activeTab]?.chartColor || "#8884d8"} strokeWidth={2} fillOpacity={1} fill="url(#colorWeight)" name="น้ำหนัก (กก.)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">ไม่มีข้อมูลสำหรับแสดงกราฟ</div>
                  )}
                </div>
              </Card>

              <Card className="rounded-3xl border-none shadow-sm bg-white p-6">
                <h3 className="text-base font-bold text-slate-900 mb-4">สัดส่วนปริมาณขยะแยกตามแหล่งที่มา</h3>
                <div className="h-64 flex flex-col md:flex-row items-center justify-center gap-4">
                  {stats.pieData.length > 0 ? (
                    <>
                      <div className="w-full md:w-1/2 h-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={stats.pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={4} dataKey="value">
                              {stats.pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value) => `${Number(value).toLocaleString()} กก.`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="w-full md:w-1/2 max-h-full overflow-y-auto space-y-2">
                        {stats.pieData.map((entry, index) => (
                          <div key={entry.name} className="flex items-center justify-between text-sm">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                              <span className="text-slate-600 truncate max-w-[120px]">{entry.name}</span>
                            </div>
                            <span className="font-semibold text-slate-900">{entry.value.toLocaleString()} กก.</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-slate-400 text-sm">ไม่มีข้อมูลสำหรับแสดงสัดส่วน</div>
                  )}
                </div>
              </Card>
            </div>

            {/* Filters & Table */}
            <Card className="rounded-3xl border-none shadow-sm bg-white overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-48">
                    <Select value={filterSource} onValueChange={setFilterSource}>
                      <SelectTrigger className="rounded-xl bg-slate-50 border-none h-10">
                        <SelectValue placeholder="แหล่งที่มาทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        {uniqueSources.map((source) => (
                          <SelectItem key={source} value={source}>
                            {source === "all" ? "แหล่งที่มาทั้งหมด" : source}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-40">
                    <Select value={timeRange} onValueChange={setTimeRange}>
                      <SelectTrigger className="rounded-xl bg-slate-50 border-none h-10">
                        <SelectValue placeholder="ช่วงเวลาทั้งหมด" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ช่วงเวลาทั้งหมด</SelectItem>
                        <SelectItem value="today">วันนี้</SelectItem>
                        <SelectItem value="week">สัปดาห์นี้</SelectItem>
                        <SelectItem value="month">เดือนนี้</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button variant="outline" className="h-10 rounded-xl border-slate-200" onClick={handleExport}>
                  <Download className="mr-2 h-4 w-4" /> Export Excel
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/70 border-b border-slate-100">
                      <th className="p-4 pl-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">วันที่-เวลา</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">แหล่งที่มา / แผนก</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">ประเภทขยะ</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">น้ำหนัก (กก.)</th>
                      <th className="p-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">หมายเหตุ</th>
                      <th className="p-4 pr-6 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {isLoading ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-slate-400">กำลังโหลดข้อมูล...</td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-sm text-slate-400">ไม่มีข้อมูลบันทึกในเงื่อนไขนี้</td>
                      </tr>
                    ) : (
                      filteredLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 pl-6 text-sm text-slate-600 whitespace-nowrap">
                            {format(new Date(log.collected_at), "dd MMM yyyy HH:mm", { locale: th })}
                          </td>
                          <td className="p-4 text-sm font-semibold text-slate-900">{log.source_name || "ไม่ระบุ"}</td>
                          <td className="p-4 text-sm">
                            <Badge variant="outline" className={cn("rounded-lg px-2.5 py-0.5 font-medium border", typesMap[log.waste_type]?.color)}>
                              {typesMap[log.waste_type]?.label || log.waste_type}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm font-bold text-slate-900 text-right">{Number(log.weight).toFixed(2)}</td>
                          <td className="p-4 text-sm text-slate-500 max-w-xs truncate">{log.note || "-"}</td>
                          <td className="p-4 pr-6 text-sm text-right space-x-1 whitespace-nowrap">
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600 rounded-lg" onClick={() => handleEdit(log)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg" onClick={() => { if(confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) deleteLog.mutate(log.id); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* บันทึกปริมาณขยะ Dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if(!open) resetForm(); }}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{editingId ? "แก้ไขข้อมูลการบันทึกขยะ" : `บันทึกข้อมูล: ${typesMap[activeTab]?.label || activeTab}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-slate-500">วันที่และเวลาบันทึกข้อมูล</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-12 px-4 rounded-2xl text-left font-normal border-slate-200 flex justify-between items-center", !selectedDate && "text-slate-400")}>
                    {selectedDate ? format(selectedDate, "dd MMMM yyyy HH:mm", { locale: th }) : <span>เลือกวันเวลา</span>}
                    <CalendarIcon className="h-4 w-4 text-slate-400" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-xl" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={(date) => date && setSelectedDate(date)} initialFocus locale={th} className="rounded-2xl" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="weight" className="text-xs font-semibold text-slate-500">น้ำหนักสุทธิ (กก.)</Label>
                <Input id="weight" type="number" step="0.01" placeholder="0.00" value={weight} onChange={(e) => setWeight(e.target.value)} className="h-12 rounded-2xl border-slate-200 font-bold" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source" className="text-xs font-semibold text-slate-500">แหล่งที่มา / รพ.สต.</Label>
                <Input id="source" placeholder="เช่น รพ.สต.แม่สรวย" value={sourceName} onChange={(e) => setSourceName(e.target.value)} className="h-12 rounded-2xl border-slate-200" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-xs font-semibold text-slate-500">หมายเหตุเพิ่มเติม</Label>
              <Input id="note" placeholder="รายละเอียดอื่นๆ ถ้ามี" value={note} onChange={(e) => setNote(e.target.value)} className="h-12 rounded-2xl border-slate-200" />
            </div>

            <Button className="w-full h-12 rounded-2xl bg-slate-900 text-white hover:bg-slate-800 font-medium mt-2" onClick={() => saveLog.mutate()} disabled={saveLog.isPending || !weight}>
              {saveLog.isPending ? "กำลังบันทึก..." : "ยืนยันการบันทึกข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ตั้งค่าประเภทขยะ Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">ตั้งค่าระบบประเภทขยะ</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-4">
            <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
              {Object.entries(typesMap).map(([key, config]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-900">{config?.label || key}</span>
                    <span className="text-xs text-slate-400">คีย์: {key}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="text-rose-500 hover:text-rose-600 rounded-xl" onClick={() => {
                    const next = { ...typesMap };
                    delete next[key];
                    setTypesMap(next);
                  }}>ลบ</Button>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
              <span className="text-xs font-bold text-slate-600 block">เพิ่มประเภทขยะใหม่</span>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="คีย์ภาษาอังกฤษ (เช่น general)" value={newTypeKey} onChange={(e) => setNewTypeKey(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="ป้ายชื่อใหม่" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} className="h-12 rounded-2xl" />
              </div>
              <Button className="h-12 rounded-2xl w-full" onClick={() => {
                const trimmedKey = newTypeKey.trim();
                const trimmedLabel = newTypeLabel.trim();
                if (!trimmedKey || !trimmedLabel) {
                  toast.error("กรุณากรอกคีย์และป้ายชื่อ");
                  return;
                }
                if (typesMap[trimmedKey]) {
                  toast.error("คีย์นี้มีอยู่แล้ว");
                  return;
                }
                setTypesMap(prev => ({
                  ...prev,
                  [trimmedKey]: {
                    label: trimmedLabel,
                    color: "bg-slate-200 text-slate-800 border-slate-300",
                    chartColor: "hsl(210 15% 55%)",
                  },
                }));
                setNewTypeKey("");
                setNewTypeLabel("");
              }}>
                เพิ่มประเภทใหม่
              </Button>
            </div>
            <Button className="w-full h-12 rounded-2xl" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>
              {saveWasteSettings.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
