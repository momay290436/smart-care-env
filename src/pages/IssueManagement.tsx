import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { exportToExcel } from "@/lib/exportExcel";
import { ChevronRight, Image as ImageIcon, Plus, CalendarIcon, Trash, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  high: { label: "สูง", color: "text-red-700", bg: "bg-red-50 border-red-200", order: 0 },
  medium: { label: "ปานกลาง", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", order: 1 },
  low: { label: "ต่ำ", color: "text-green-700", bg: "bg-green-50 border-green-200", order: 2 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอการจัดการ", color: "bg-red-500 text-white", icon: null },
  in_progress: { label: "อยู่ระหว่างดำเนินการ", color: "bg-amber-500 text-white", icon: null },
  resolved: { label: "แก้ไขปัญหาแล้ว", color: "bg-emerald-500 text-white", icon: null },
};

const MODULE_LABELS: Record<string, string> = {
  env_round: "ENV Round", fire_check: "ตรวจถังดับเพลิง", water_quality: "คุณภาพน้ำ",
  water_pathogen: "ตรวจเชื้อน้ำ", repair: "ระบบแจ้งซ่อม", waste: "จัดการขยะ",
  hazmat: "คลังสารเคมี", "5s": "ระบบ 5ส",
};

export default function IssueManagement() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addForm, setAddForm] = useState<any>({ title: "", description: "", severity: "medium", status: "pending", resolution_notes: "", department_name: "", photo_url: "", occurred_at: undefined as Date | undefined, resolved_at: undefined as Date | undefined });
  const [editDates, setEditDates] = useState<{ occurred_at?: Date; resolved_at?: Date }>({});

  const { data: deptList = [] } = useQuery({
    queryKey: ["issue-areas-list"],
    queryFn: async () => {
      const { data } = await supabase.from("issue_areas").select("id, name").order("name");
      if (data && data.length > 0) return data;
      const { data: depts } = await supabase.from("departments").select("id, name").order("name");
      return depts || [];
    },
  });

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data } = await supabase.from("issues").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  

  const allIssues = useMemo(() => {
    return issues
      .filter((i) => {
        if (filterStatus !== "all" && i.status !== filterStatus) return false;
        if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
        if (filterDept !== "all" && i.department_name !== filterDept) return false;
        return true;
      })
      .sort((a, b) => {
        const sa = SEVERITY_CONFIG[a.severity]?.order ?? 9;
        const sb = SEVERITY_CONFIG[b.severity]?.order ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [issues, filterStatus, filterSeverity, filterDept]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status, updated_at: new Date().toISOString(), resolution_notes: resolutionNotes || null };
      if (editDates.occurred_at) update.occurred_at = editDates.occurred_at.toISOString();
      if (editDates.resolved_at) update.resolved_at = editDates.resolved_at.toISOString();
      if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolved_by = user?.id; }
      const { error } = await supabase.from("issues").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัพเดตสถานะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setSelected(null);
      setResolutionNotes("");
      setEditDates({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteIssue = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("issues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบปัญหาสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDatesOnly = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const update: any = { updated_at: new Date().toISOString() };
      update.occurred_at = editDates.occurred_at ? editDates.occurred_at.toISOString() : null;
      update.resolved_at = editDates.resolved_at ? editDates.resolved_at.toISOString() : null;
      const { error } = await supabase.from("issues").update(update).eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("บันทึกวันที่สำเร็จ"); queryClient.invalidateQueries({ queryKey: ["issues"] }); setSelected(null); setEditDates({}); },
    onError: (e: any) => toast.error(e.message),
  });

  const createIssue = useMutation({
    mutationFn: async () => {
      if (!addForm.title.trim()) throw new Error("กรุณากรอกหัวข้อปัญหา");
      const payload: any = {
        title: addForm.title.trim(),
        description: addForm.description || null,
        severity: addForm.severity,
        status: addForm.status,
        source_module: "manual",
        created_by: user?.id || null,
        resolution_notes: addForm.resolution_notes || null,
        department_name: addForm.department_name || null,
        photo_url: addForm.photo_url?.trim() || null,
        occurred_at: addForm.occurred_at ? addForm.occurred_at.toISOString() : null,
      };
      if (addForm.resolved_at) {
        payload.resolved_at = addForm.resolved_at.toISOString();
        payload.resolved_by = user?.id || null;
      } else if (addForm.status === "resolved") {
        payload.resolved_at = new Date().toISOString();
        payload.resolved_by = user?.id || null;
      }
      const { error } = await supabase.from("issues").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มปัญหาสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setShowAddDialog(false);
      setAddForm({ title: "", description: "", severity: "medium", status: "pending", resolution_notes: "", department_name: "", photo_url: "", occurred_at: undefined, resolved_at: undefined });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleStatusChange = (issue: any, newStatus: string) => {
    updateStatus.mutate({ id: issue.id, status: newStatus });
  };

  const counts = useMemo(() => ({
    pending: allIssues.filter(i => i.status === "pending").length,
    in_progress: allIssues.filter(i => i.status === "in_progress").length,
    resolved: allIssues.filter(i => i.status === "resolved").length,
  }), [allIssues]);

  const getModuleLabel = (m: string) => {
    return MODULE_LABELS[m] || null;
  };

  const handleExport = () => {
    try {
      const rows = allIssues.map((i: any) => ({
        id: i.id,
        title: i.title,
        description: i.description || "",
        severity: SEVERITY_CONFIG[i.severity]?.label || i.severity,
        status: STATUS_CONFIG[i.status]?.label || i.status,
        module: getModuleLabel(i.source_module) || "",
        department: i.department_name || "",
        created_at: i.created_at ? new Date(i.created_at).toISOString() : "",
        occurred_at: i.occurred_at ? new Date(i.occurred_at).toISOString() : "",
        resolved_at: i.resolved_at ? new Date(i.resolved_at).toISOString() : "",
        resolution_notes: i.resolution_notes || "",
        photo_url: i.photo_url || "",
      }));
      const fileName = `issues_export_${format(new Date(), "yyyyMMdd_HHmm")}`;
      exportToExcel(rows, fileName, "Issues");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="จัดการปัญหา" subtitle="Issue Management — รวบรวมปัญหาจากทุกระบบ">
        <Button className="rounded-2xl h-10 gap-1.5 bg-slate-900 hover:bg-slate-800" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" /> เพิ่มปัญหา
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="bg-white rounded-3xl shadow-2xl border border-slate-200 border-t-4 border-t-red-500">
          <CardContent className="min-h-[130px] p-5 text-center flex flex-col justify-center gap-3">
            <p className="text-3xl md:text-4xl font-extrabold text-red-600">{counts.pending}</p>
            <p className="text-sm md:text-base text-slate-600">รอการจัดการ</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-3xl shadow-2xl border border-slate-200 border-t-4 border-t-amber-500">
          <CardContent className="min-h-[130px] p-5 text-center flex flex-col justify-center gap-3">
            <p className="text-3xl md:text-4xl font-extrabold text-amber-600">{counts.in_progress}</p>
            <p className="text-sm md:text-base text-slate-600">กำลังดำเนินการ</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-3xl shadow-2xl border border-slate-200 border-t-4 border-t-emerald-500">
          <CardContent className="min-h-[130px] p-5 text-center flex flex-col justify-center gap-3">
            <p className="text-3xl md:text-4xl font-extrabold text-emerald-600">{counts.resolved}</p>
            <p className="text-sm md:text-base text-slate-600">แก้ไขแล้ว</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-12 w-44 rounded-2xl text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">รอการจัดการ</SelectItem>
            <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
            <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-12 w-40 rounded-2xl text-base"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับ</SelectItem>
            <SelectItem value="high">สูง</SelectItem>
            <SelectItem value="medium">ปานกลาง</SelectItem>
            <SelectItem value="low">ต่ำ</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="h-12 w-48 rounded-2xl text-base"><SelectValue placeholder="ทุกแผนก" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกแผนก</SelectItem>
            {deptList.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-12 px-5 flex items-center rounded-2xl text-base">{allIssues.length} รายการ</Badge>
        <Button variant="outline" className="h-12 rounded-2xl gap-1.5" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      {/* Issue List */}
      <div className="space-y-2">
        {allIssues.map((issue) => {
          const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
          const stat = STATUS_CONFIG[issue.status] || STATUS_CONFIG.pending;
          return (
            <Card
              key={issue.id}
              className={`bg-slate-50 rounded-2xl border border-slate-200 shadow-md hover:shadow-lg transition-all cursor-pointer`}
              onClick={() => { setSelected(issue); setResolutionNotes(issue.resolution_notes || ""); }}
            >
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl font-bold ${issue.severity === "high" ? "bg-red-100 text-red-600" : issue.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>
                  {issue.severity === "high" ? "!" : issue.severity === "medium" ? "·" : "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base md:text-lg font-semibold">{issue.title}</p>
                  {issue.description && <p className="text-sm text-muted-foreground mt-2 max-h-16 overflow-hidden">{issue.description}</p>}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    {getModuleLabel(issue.source_module) && (
                      <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{getModuleLabel(issue.source_module)}</Badge>
                    )}
                    <Badge className={`text-sm rounded-full px-3 py-1 ${stat.color}`}>{stat.label}</Badge>
                    <Badge variant="outline" className={`text-sm rounded-full px-3 py-1 ${sev.color}`}>ความรุนแรง: {sev.label}</Badge>
                    <p className="text-sm text-muted-foreground mt-2 ml-1">{format(new Date(issue.created_at), "d MMM yy HH:mm", { locale: th })}{issue.department_name ? ` · ${issue.department_name}` : ""}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 ml-2">
                  {isAdmin && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddForm({
                            title: issue.title || "",
                            description: issue.description || "",
                            severity: issue.severity || "medium",
                            status: issue.status || "pending",
                            resolution_notes: issue.resolution_notes || "",
                            department_name: issue.department_name || "",
                            photo_url: issue.photo_url || "",
                            occurred_at: issue.occurred_at ? new Date(issue.occurred_at) : undefined,
                            resolved_at: issue.resolved_at ? new Date(issue.resolved_at) : undefined,
                          });
                          setShowAddDialog(true);
                        }}
                      >
                        แก้ไข
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-9 rounded-xl"
                        onClick={(e) => { e.stopPropagation(); setSelected(issue); setResolutionNotes(issue.resolution_notes || ""); }}
                      >
                        จัดการ
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-9 rounded-xl text-red-600 border-red-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          const ok = window.confirm("ยืนยันการลบปัญหานี้หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้");
                          if (!ok) return;
                          deleteIssue.mutate(issue.id);
                        }}
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          );
        })}
        {allIssues.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p className="text-3xl mb-3">✅</p>
              <p className="text-base font-medium">ไม่มีรายการปัญหา</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="rounded-3xl w-full max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader><DialogTitle className="text-2xl md:text-3xl">รายละเอียดปัญหา</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className="rounded-2xl p-5 bg-slate-50 border border-slate-200">
                <p className="text-lg md:text-xl font-bold">{selected.title}</p>
                <p className="text-sm md:text-base text-muted-foreground mt-2">{selected.description || "-"}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  {getModuleLabel(selected.source_module) && (
                    <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{getModuleLabel(selected.source_module)}</Badge>
                  )}
                  <Badge variant="outline" className={`text-sm rounded-full px-3 py-1 ${SEVERITY_CONFIG[selected.severity]?.color}`}>ความรุนแรง: {SEVERITY_CONFIG[selected.severity]?.label}</Badge>
                  {selected.department_name && <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{selected.department_name}</Badge>}
                </div>
              <p className="text-sm md:text-base text-muted-foreground mt-3">{format(new Date(selected.created_at), "d MMMM yyyy HH:mm น.", { locale: th })}</p>
              </div>

              {selected.photo_url && (
                <div>
                  <p className="text-sm font-semibold mb-2">รูปภาพประกอบ</p>
                  <a href={selected.photo_url} target="_blank" rel="noreferrer" className="block">
                    <img src={selected.photo_url} alt="ภาพความผิดปกติ" className="rounded-2xl w-full max-h-60 object-cover border" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <p className="text-xs text-blue-600 mt-1 truncate underline">{selected.photo_url}</p>
                  </a>
                </div>
              )}

              {isAdmin && (
                <div className="grid grid-cols-2 gap-2 border rounded-2xl p-3 bg-slate-50">
                  <div>
                    <Label className="text-xs font-semibold">วันที่พบปัญหา</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-full h-10 rounded-xl justify-start mt-1 text-xs", !(editDates.occurred_at || selected.occurred_at) && "text-muted-foreground")}>
                          <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                          {editDates.occurred_at ? format(editDates.occurred_at, "d MMM yy", { locale: th }) : selected.occurred_at ? format(new Date(selected.occurred_at), "d MMM yy", { locale: th }) : "เลือกวันที่"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editDates.occurred_at || (selected.occurred_at ? new Date(selected.occurred_at) : undefined)} onSelect={(d) => setEditDates((p) => ({ ...p, occurred_at: d }))} className="pointer-events-auto p-3" /></PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">วันที่แก้ไข</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className={cn("w-full h-10 rounded-xl justify-start mt-1 text-xs", !(editDates.resolved_at || selected.resolved_at) && "text-muted-foreground")}>
                          <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
                          {editDates.resolved_at ? format(editDates.resolved_at, "d MMM yy", { locale: th }) : selected.resolved_at ? format(new Date(selected.resolved_at), "d MMM yy", { locale: th }) : "เลือกวันที่"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={editDates.resolved_at || (selected.resolved_at ? new Date(selected.resolved_at) : undefined)} onSelect={(d) => setEditDates((p) => ({ ...p, resolved_at: d }))} className="pointer-events-auto p-3" /></PopoverContent>
                    </Popover>
                  </div>
                  <Button size="sm" variant="secondary" className="col-span-2 rounded-xl h-9" onClick={() => saveDatesOnly.mutate()} disabled={saveDatesOnly.isPending}>บันทึกวันที่</Button>
                </div>
              )}

              <div>
                <Label className="text-sm font-semibold">วิธีการจัดการ/แก้ไขปัญหา</Label>
                <Textarea
                  value={resolutionNotes || selected.resolution_notes || ""}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="ระบุวิธีการแก้ไขปัญหา..."
                  rows={3}
                  className="rounded-2xl mt-1"
                />
              </div>

              <div>
                <p className="text-sm font-semibold mb-2">อัพเดตสถานะ</p>
                <div className="grid grid-cols-1 gap-2">
                  {(["pending", "in_progress", "resolved"] as const).map((s) => {
                    const cfg = STATUS_CONFIG[s];
                    const isCurrent = selected.status === s;
                    return (
                      <Button
                        key={s}
                        variant={isCurrent ? "default" : "outline"}
                        className={`h-12 rounded-2xl text-sm font-bold ${isCurrent ? cfg.color : ""}`}
                        disabled={isCurrent}
                        onClick={() => handleStatusChange(selected, s)}
                      >
                        {cfg.label}
                        {isCurrent && " (ปัจจุบัน)"}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Issue Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="rounded-3xl w-full max-w-2xl md:max-w-3xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader><DialogTitle className="text-2xl md:text-3xl">เพิ่มปัญหาที่พบ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-semibold">หัวข้อปัญหา *</Label>
              <Input value={addForm.title} onChange={(e) => setAddForm({ ...addForm, title: e.target.value })} placeholder="เช่น อุปกรณ์ชำรุด" className="h-11 rounded-2xl mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">แผนก / พื้นที่</Label>
              <Select value={addForm.department_name} onValueChange={(v) => setAddForm({ ...addForm, department_name: v })}>
                <SelectTrigger className="h-11 rounded-2xl mt-1"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {deptList.map((d: any) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">แอดมินสามารถเพิ่ม/แก้ไขรายการได้ที่หน้า ตั้งค่า → พื้นที่ปัญหา</p>
            </div>
            <div>
              <Label className="text-sm font-semibold">รายละเอียดปัญหาที่พบ</Label>
              <Textarea rows={3} value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} placeholder="อธิบายรายละเอียด..." className="rounded-2xl mt-1" />
            </div>
            <div>
              <Label className="text-sm font-semibold">URL รูปภาพ (Google Drive / ลิงก์)</Label>
              <Input value={addForm.photo_url} onChange={(e) => setAddForm({ ...addForm, photo_url: e.target.value })} placeholder="https://drive.google.com/..." className="h-11 rounded-2xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">วันที่พบปัญหา</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-11 rounded-2xl justify-start mt-1", !addForm.occurred_at && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {addForm.occurred_at ? format(addForm.occurred_at, "d MMM yy", { locale: th }) : "เลือกวันที่"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={addForm.occurred_at} onSelect={(d) => setAddForm({ ...addForm, occurred_at: d })} className="pointer-events-auto p-3" /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm font-semibold">วันที่แก้ไขเสร็จ</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-11 rounded-2xl justify-start mt-1", !addForm.resolved_at && "text-muted-foreground")}>
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {addForm.resolved_at ? format(addForm.resolved_at, "d MMM yy", { locale: th }) : "-"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={addForm.resolved_at} onSelect={(d) => setAddForm({ ...addForm, resolved_at: d })} className="pointer-events-auto p-3" /></PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">แนวทางจัดการ</Label>
              <Textarea rows={2} value={addForm.resolution_notes} onChange={(e) => setAddForm({ ...addForm, resolution_notes: e.target.value })} placeholder="ระบุแนวทางแก้ไข..." className="rounded-2xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">ความรุนแรง</Label>
                <Select value={addForm.severity} onValueChange={(v) => setAddForm({ ...addForm, severity: v })}>
                  <SelectTrigger className="h-11 rounded-2xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">สูง</SelectItem>
                    <SelectItem value="medium">ปานกลาง</SelectItem>
                    <SelectItem value="low">ต่ำ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold">สถานะ</Label>
                <Select value={addForm.status} onValueChange={(v) => setAddForm({ ...addForm, status: v })}>
                  <SelectTrigger className="h-11 rounded-2xl mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอดำเนินการ</SelectItem>
                    <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
                    <SelectItem value="resolved">ได้รับการแก้ไขแล้ว</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full h-12 rounded-2xl bg-slate-900 hover:bg-slate-800 text-base font-bold" disabled={createIssue.isPending} onClick={() => createIssue.mutate()}>
              {createIssue.isPending ? "กำลังบันทึก..." : "บันทึกปัญหา"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}