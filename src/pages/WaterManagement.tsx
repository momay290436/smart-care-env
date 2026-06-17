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
import { createAutoIssue, getIssueSeverity, hasWaterQualityAnomaly } from "@/lib/waterSafetyUtils";
import { CalendarIcon, Download, History, Loader2, Plus, SlidersHorizontal, Table, Wrench, Edit, Trash2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import WastewaterInsertDialog from "./WastewaterInsertDialog";
import WastewaterStatsDialog from "./WastewaterStatsDialog";

export default function WaterManagement() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("logs");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  
  // Dialog States
  const [showWastewaterDialog, setShowWastewaterDialog] = useState(false);
  const [showWastewaterStatsDialog, setShowWastewaterStatsDialog] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    chlorine_concentration: "",
    ph_level: "",
    is_normal: true,
    notes: ""
  });

  // Disinfectant state additions
  const [showDisinfectantDialog, setShowDisinfectantDialog] = useState(false);
  const [editingDisinfectantLog, setEditingDisinfectantLog] = useState<any>(null);
  const [editDisinfectantForm, setEditDisinfectantForm] = useState({
    source_concentration: "",
    outlet_concentration: "",
    outlet_ph: "",
    notes: ""
  });

  // Fetch Wastewater Inspection Logs
  const { data: wastewaterLogs = [], isLoading: isLoadingWastewater } = useQuery({
    queryKey: ["wastewater-logs", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("wastewater_inspections")
        .select(`
          *,
          profiles:inspected_by (
            full_name
          )
        `)
        .order("inspected_at", { ascending: false });

      if (dateFilter) {
        const start = startOfDay(dateFilter).toISOString();
        const end = endOfDay(dateFilter).toISOString();
        query = query.gte("inspected_at", start).lte("inspected_at", end);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch Disinfectant Logs
  const { data: disinfectantLogs = [], isLoading: isLoadingDisinfectant } = useQuery({
    queryKey: ["disinfectant-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disinfectant_logs")
        .select(`
          *,
          profiles:logged_by (
            full_name
          )
        `)
        .order("logged_at", { ascending: false });

      if (error) throw error;
      return data || [];
    }
  });

  // Delete Mutations
  const deleteWastewaterLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wastewater_inspections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบบันทึกข้อมูลสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-logs"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const deleteDisinfectantLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("disinfectant_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบบันทึกสารฆ่าเชื้อสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["disinfectant-logs"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  // Update Mutations
  const updateWastewaterLog = useMutation({
    mutationFn: async () => {
      if (!editingLog) return;
      const { error } = await supabase
        .from("wastewater_inspections")
        .update({
          chlorine_concentration: parseFloat(editForm.chlorine_concentration),
          ph_level: parseFloat(editForm.ph_level),
          is_normal: editForm.is_normal,
          notes: editForm.notes
        })
        .eq("id", editingLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("แก้ไขข้อมูลสำเร็จ");
      setEditingLog(null);
      queryClient.invalidateQueries({ queryKey: ["wastewater-logs"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const updateDisinfectantLog = useMutation({
    mutationFn: async () => {
      if (!editingDisinfectantLog) return;
      const { error } = await supabase
        .from("disinfectant_logs")
        .update({
          source_concentration: parseFloat(editDisinfectantForm.source_concentration),
          outlet_concentration: parseFloat(editDisinfectantForm.outlet_concentration),
          outlet_ph: parseFloat(editDisinfectantForm.outlet_ph),
          notes: editDisinfectantForm.notes
        })
        .eq("id", editingDisinfectantLog.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("แก้ไขข้อมูลสารฆ่าเชื้อสำเร็จ");
      setEditingDisinfectantLog(null);
      queryClient.invalidateQueries({ queryKey: ["disinfectant-logs"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  const handleEditClick = (log: any) => {
    setEditingLog(log);
    setEditForm({
      chlorine_concentration: log.chlorine_concentration?.toString() || "",
      ph_level: log.ph_level?.toString() || "",
      is_normal: log.is_normal,
      notes: log.notes || ""
    });
  };

  const handleEditDisinfectantClick = (log: any) => {
    setEditingDisinfectantLog(log);
    setEditDisinfectantForm({
      source_concentration: log.source_concentration?.toString() || "",
      outlet_concentration: log.outlet_concentration?.toString() || "",
      outlet_ph: log.outlet_ph?.toString() || "",
      notes: log.notes || ""
    });
  };

  const handleExportWastewater = () => {
    if (wastewaterLogs.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const dataToExport = wastewaterLogs.map(log => ({
      "วันที่-เวลา": format(new Date(log.inspected_at), "d MMM yyyy HH:mm", { locale: th }),
      "คลอรีนอิสระ (mg/L)": log.chlorine_concentration,
      "ค่า pH": log.ph_level,
      "สถานะ": log.is_normal ? "ปกติ" : "ผิดปกติ",
      "ผู้ตรวจ": log.profiles?.full_name || "ระบบ",
      "หมายเหตุ": log.notes || "-"
    }));
    exportToExcel(dataToExport, `ประวัติการตรวจระบบน้ำเสีย_${format(new Date(), "yyyy-MM-dd")}`);
  };

  const handleExportDisinfectant = () => {
    if (disinfectantLogs.length === 0) {
      toast.error("ไม่มีข้อมูลสำหรับส่งออก");
      return;
    }
    const dataToExport = disinfectantLogs.map(log => ({
      "วันที่-เวลา": format(new Date(log.logged_at), "d MMM yyyy HH:mm", { locale: th }),
      "ความเข้มข้นต้นทาง (mg/L)": log.source_concentration,
      "ความเข้มข้นปลายทาง (mg/L)": log.outlet_concentration,
      "pH ปลายทาง": log.outlet_ph,
      "ผู้บันทึก": log.profiles?.full_name || "ระบบ",
      "หมายเหตุ": log.notes || "-"
    }));
    exportToExcel(dataToExport, `บันทึกสารฆ่าเชื้อ_${format(new Date(), "yyyy-MM-dd")}`);
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader 
        title="Water & Wastewater" 
        subtitle="ระบบจัดการน้ำประปาและบำบัดน้ำเสีย"
      />

      <div className="flex flex-wrap gap-2">
        <Button className="rounded-2xl font-bold h-11" onClick={() => setShowWastewaterDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> บันทึกตรวจน้ำเสีย
        </Button>
        <Button variant="outline" className="rounded-2xl font-semibold h-11 bg-white" onClick={() => setShowWastewaterStatsDialog(true)}>
          <Table className="h-4 w-4 mr-1" /> แดชบอร์ดสรุปผล
        </Button>
        <Button variant="outline" className="rounded-2xl font-semibold h-11 bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50" onClick={() => setShowDisinfectantDialog(true)}>
          <Plus className="h-4 w-4 mr-1" /> บันทึกสารฆ่าเชื้อ
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-12 rounded-2xl bg-white/10 p-1">
          <TabsTrigger value="logs" className="rounded-xl font-semibold text-xs data-[state=active]:bg-white data-[state=active]:text-card-foreground">
            <History className="w-3.5 h-3.5 mr-1" /> ประวัติตรวจน้ำเสีย
          </TabsTrigger>
          <TabsTrigger value="disinfectant" className="rounded-xl font-semibold text-xs data-[state=active]:bg-white data-[state=active]:text-card-foreground">
            <Wrench className="w-3.5 h-3.5 mr-1" /> บันทึกเติมสารฆ่าเชื้อ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-3 mt-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("h-10 rounded-2xl bg-white text-xs font-medium", !dateFilter && "text-muted-foreground")}>
                    <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                    {dateFilter ? format(dateFilter, "d MMM yyyy", { locale: th }) : "กรองตามวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-elevated" align="start">
                  <Calendar mode="single" selected={dateFilter} onSelect={setDateFilter} initialFocus locale={th} />
                </PopoverContent>
              </Popover>
              {dateFilter && (
                <Button variant="ghost" size="sm" onClick={() => setDateFilter(undefined)} className="text-xs text-muted-foreground h-9 rounded-xl">
                  ล้างตัวกรอง
                </Button>
              )}
            </div>

            <Button variant="outline" size="sm" className="h-10 rounded-2xl bg-white text-xs text-slate-700 font-semibold" onClick={handleExportWastewater}>
              <Download className="h-3.5 w-3.5 mr-1" /> ส่งออก Excel
            </Button>
          </div>

          {isLoadingWastewater ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : wastewaterLogs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">ไม่พบประวัติการบันทึกข้อมูล</p>
          ) : (
            <div className="space-y-2.5">
              {wastewaterLogs.map((log) => {
                const isChlorineAnomalous = log.chlorine_concentration === null || log.chlorine_concentration < 0.5 || log.chlorine_concentration > 1;
                const isPhAnomalous = log.ph_level === null || log.ph_level < 6.5 || log.ph_level > 8.5;

                return (
                  <Card key={log.id} className="shadow-card bg-card rounded-2xl border-none overflow-hidden">
                    <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-card-foreground">
                            {format(new Date(log.inspected_at), "d MMM yyyy HH:mm", { locale: th })}
                          </span>
                          <Badge className={cn("rounded-xl text-[10px] font-bold px-2 py-0.5 border-none", log.is_normal ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {log.is_normal ? "ปกติ" : "ระบบแจ้งเตือน"}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                          <span className={cn(isChlorineAnomalous && "text-destructive font-bold bg-red-50 px-1.5 py-0.5 rounded-lg")}>
                            คลอรีน: {log.chlorine_concentration !== null ? `${log.chlorine_concentration} mg/L` : "ไม่ได้ระบุ"}
                          </span>
                          <span className={cn(isPhAnomalous && "text-destructive font-bold bg-red-50 px-1.5 py-0.5 rounded-lg")}>
                            pH: {log.ph_level !== null ? log.ph_level : "ไม่ได้ระบุ"}
                          </span>
                          <span>ผู้ตรวจ: {log.profiles?.full_name || "ไม่ระบุ"}</span>
                        </div>
                        {log.notes && <p className="text-xs text-amber-600 bg-amber-50/60 px-2 py-1 rounded-xl mt-1.5 border border-amber-100/50 w-fit">{log.notes}</p>}
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-1 self-end sm:self-center">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" onClick={() => handleEditClick(log)}>
                            <Edit className="h-4 w-4 text-slate-500" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-destructive" onClick={() => deleteWastewaterLog.mutate(log.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="disinfectant" className="space-y-3 mt-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" className="h-10 rounded-2xl bg-white text-xs text-slate-700 font-semibold" onClick={handleExportDisinfectant}>
              <Download className="h-3.5 w-3.5 mr-1" /> ส่งออก Excel
            </Button>
          </div>

          {isLoadingDisinfectant ? (
            <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : disinfectantLogs.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">ไม่พบประวัติการบันทึกสารฆ่าเชื้อ</p>
          ) : (
            <div className="space-y-2.5">
              {disinfectantLogs.map((log) => (
                <Card key={log.id} className="shadow-card bg-card rounded-2xl border-none overflow-hidden">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-card-foreground">
                        {format(new Date(log.logged_at), "d MMM yyyy HH:mm", { locale: th })}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground font-medium">
                        <span>ต้นทาง: {log.source_concentration} mg/L</span>
                        <span>ปลายทาง: {log.outlet_concentration} mg/L</span>
                        <span>pH ปลายทาง: {log.outlet_ph || "-"}</span>
                        <span>ผู้บันทึก: {log.profiles?.full_name || "ไม่ระบุ"}</span>
                      </div>
                      {log.notes && <p className="text-xs text-slate-500 bg-muted px-2 py-1 rounded-xl mt-1">{log.notes}</p>}
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 self-end sm:self-center">
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" onClick={() => handleEditDisinfectantClick(log)}>
                          <Edit className="h-4 w-4 text-slate-500" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl text-destructive" onClick={() => deleteDisinfectantLog.mutate(log.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Wastewater inspection Edit Dialog */}
      <Dialog open={!!editingLog} onOpenChange={(open) => !open && setEditingLog(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">แก้ไขบันทึกตรวจระบบน้ำเสีย</DialogTitle>
          </DialogHeader>
          {editingLog && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">คลอรีนอิสระ (mg/L)</Label>
                  <Input type="number" step="0.01" value={editForm.chlorine_concentration} onChange={(e) => setEditForm({ ...editForm, chlorine_concentration: e.target.value })} className="h-10 rounded-2xl" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">ค่า pH</Label>
                  <Input type="number" step="0.1" value={editForm.ph_level} onChange={(e) => setEditForm({ ...editForm, ph_level: e.target.value })} className="h-10 rounded-2xl" />
                </div>
              </div>
              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">สถานะการทำงาน</Label>
                  <p className="text-[11px] text-muted-foreground">ระบุสถานะระบบภาพรวมปกติหรือไม่</p>
                </div>
                <Checkbox checked={editForm.is_normal} onCheckedChange={(checked) => setEditForm({ ...editForm, is_normal: !!checked })} className="rounded-md h-5 w-5" />
              </div>
              <div>
                <Label className="font-semibold">หมายเหตุ / ปัญหาที่พบ</Label>
                <Textarea value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="ระบุข้อมูลเพิ่มเติม..." rows={2} className="rounded-2xl" />
              </div>
              <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => updateWastewaterLog.mutate()} disabled={updateWastewaterLog.isPending}>
                {updateWastewaterLog.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Disinfectant Edit Dialog */}
      <Dialog open={!!editingDisinfectantLog} onOpenChange={(open) => !open && setEditingDisinfectantLog(null)}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">แก้ไขบันทึกสารฆ่าเชื้อ</DialogTitle>
          </DialogHeader>
          {editingDisinfectantLog && (
            <div className="space-y-4 pt-2">
              <div>
                <Label className="text-xs font-semibold">ความเข้มข้นต้นทาง (mg/L)</Label>
                <Input type="number" step="0.1" value={editDisinfectantForm.source_concentration} onChange={(e) => setEditDisinfectantForm({ ...editDisinfectantForm, source_concentration: e.target.value })} className="h-10 rounded-2xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-semibold">ความเข้มข้นปลายทาง (mg/L)</Label>
                  <Input type="number" step="0.01" value={editDisinfectantForm.outlet_concentration} onChange={(e) => setEditDisinfectantForm({ ...editDisinfectantForm, outlet_concentration: e.target.value })} className="h-10 rounded-2xl" />
                </div>
                <div>
                  <Label className="text-xs font-semibold">pH ปลายทาง</Label>
                  <Input type="number" step="0.1" value={editDisinfectantForm.outlet_ph} onChange={(e) => setEditDisinfectantForm({ ...editDisinfectantForm, outlet_ph: e.target.value })} className="h-10 rounded-2xl" />
                </div>
              </div>
              <div>
                <Label className="font-semibold">หมายเหตุ</Label>
                <Textarea value={editDisinfectantForm.notes} onChange={(e) => setEditDisinfectantForm({ ...editDisinfectantForm, notes: e.target.value })} placeholder="หมายเหตุเพิ่มเติม..." rows={2} className="rounded-2xl" />
              </div>
              <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => updateDisinfectantLog.mutate()} disabled={updateDisinfectantLog.isPending}>
                {updateDisinfectantLog.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Wastewater inspection insert dialog */}
      <WastewaterInsertDialog open={showWastewaterDialog} onOpenChange={setShowWastewaterDialog} />
      <WastewaterStatsDialog open={showWastewaterStatsDialog} onOpenChange={setShowWastewaterStatsDialog} />
    </div>
  );
}
