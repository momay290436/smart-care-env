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
import { ChevronRight, Image as ImageIcon } from "lucide-react";

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
  hazmat: "คลังสารเคมี", "5s": "ระบบ 5ส", manual: "แจ้งด้วยตนเอง",
};

export default function IssueManagement() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [selected, setSelected] = useState<any>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: deptList = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id, name").order("name");
      return data || [];
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
      if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolved_by = user?.id; }
      const { error } = await supabase.from("issues").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัพเดตสถานะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setSelected(null);
      setResolutionNotes("");
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

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="จัดการปัญหา" subtitle="Issue Management — รวบรวมปัญหาจากทุกระบบ" />

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
      </div>

      {/* Issue List */}
      <div className="space-y-2">
        {allIssues.map((issue) => {
          const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
          const stat = STATUS_CONFIG[issue.status] || STATUS_CONFIG.pending;
          return (
            <Card key={issue.id} className={`rounded-2xl border shadow-card hover:shadow-elevated transition-all cursor-pointer ${sev.bg}`} onClick={() => { setSelected(issue); setResolutionNotes(issue.resolution_notes || ""); }}>
              <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-xl font-bold ${issue.severity === "high" ? "bg-red-100 text-red-600" : issue.severity === "medium" ? "bg-amber-100 text-amber-600" : "bg-green-100 text-green-600"}`}>
                  {issue.severity === "high" ? "!" : issue.severity === "medium" ? "·" : "—"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base md:text-lg font-semibold truncate">{issue.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{MODULE_LABELS[issue.source_module] || issue.source_module}</Badge>
                    <Badge className={`text-sm rounded-full px-3 py-1 ${stat.color}`}>
                      {stat.label}
                    </Badge>
                    <Badge variant="outline" className={`text-sm rounded-full px-3 py-1 ${sev.color}`}>ความรุนแรง: {sev.label}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{format(new Date(issue.created_at), "d MMM yy HH:mm", { locale: th })}{issue.department_name ? ` · ${issue.department_name}` : ""}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
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
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl">รายละเอียดปัญหา</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-5">
              <div className={`rounded-2xl p-5 ${SEVERITY_CONFIG[selected.severity]?.bg || "bg-slate-50"}`}>
                <p className="text-lg md:text-xl font-bold">{selected.title}</p>
                <p className="text-sm md:text-base text-muted-foreground mt-2">{selected.description || "-"}</p>
                <div className="flex gap-2 mt-3 flex-wrap">
                  <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{MODULE_LABELS[selected.source_module] || selected.source_module}</Badge>
                  <Badge variant="outline" className={`text-sm rounded-full px-3 py-1 ${SEVERITY_CONFIG[selected.severity]?.color}`}>ความรุนแรง: {SEVERITY_CONFIG[selected.severity]?.label}</Badge>
                  {selected.department_name && <Badge variant="outline" className="text-sm rounded-full px-3 py-1">{selected.department_name}</Badge>}
                </div>
              <p className="text-sm md:text-base text-muted-foreground mt-3">{format(new Date(selected.created_at), "d MMMM yyyy HH:mm น.", { locale: th })}</p>
              </div>

              {selected.photo_url && (
                <div>
                  <p className="text-sm font-semibold mb-2">รูปภาพประกอบ</p>
                  <img src={selected.photo_url} alt="ภาพความผิดปกติ" className="rounded-2xl w-full max-h-60 object-cover border" />
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
    </div>
  );
}