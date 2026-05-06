import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { AlertTriangle, CheckCircle2, Clock, Loader2, ChevronRight } from "lucide-react";

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string; order: number }> = {
  high: { label: "สูง", color: "text-red-700", bg: "bg-red-50 border-red-200", order: 0 },
  medium: { label: "ปานกลาง", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", order: 1 },
  low: { label: "ต่ำ", color: "text-green-700", bg: "bg-green-50 border-green-200", order: 2 },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "รอการจัดการ", color: "bg-red-500 text-white", icon: Clock },
  in_progress: { label: "อยู่ระหว่างดำเนินการ", color: "bg-amber-500 text-white", icon: Loader2 },
  resolved: { label: "แก้ไขปัญหาแล้ว", color: "bg-emerald-500 text-white", icon: CheckCircle2 },
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
  const [selected, setSelected] = useState<any>(null);

  const { data: issues = [] } = useQuery({
    queryKey: ["issues"],
    queryFn: async () => {
      const { data } = await supabase.from("issues").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  // Also pull ENV round abnormal items as virtual issues
  const { data: envAbnormal = [] } = useQuery({
    queryKey: ["env-abnormal-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("env_round_items").select("id, category, item_name, result, severity, details, photo_url, env_rounds(id, status, created_at, departments(name))").eq("result", "abnormal").order("created_at", { ascending: false }).limit(200);
      return (data || []).map((item: any) => ({
        id: `env_${item.id}`, title: `${item.item_name} - ${item.category}`,
        description: item.details || "พบความผิดปกติจาก ENV Round",
        source_module: "env_round", source_id: item.env_rounds?.id,
        severity: item.severity || "medium", status: "pending",
        created_at: item.env_rounds?.created_at || new Date().toISOString(),
        _dept: item.env_rounds?.departments?.name,
      }));
    },
  });

  // Pull repair tickets with pending status
  const { data: repairIssues = [] } = useQuery({
    queryKey: ["repair-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("repair_tickets").select("id, description, priority, status, created_at, equipment(name, departments(name))").in("status", ["pending", "accepted"]).order("created_at", { ascending: false }).limit(100);
      return (data || []).map((t: any) => ({
        id: `repair_${t.id}`, title: t.description || "งานซ่อม",
        description: `อุปกรณ์: ${t.equipment?.name || "-"} | แผนก: ${t.equipment?.departments?.name || "-"}`,
        source_module: "repair", source_id: t.id,
        severity: t.priority === "urgent" ? "high" : t.priority === "high" ? "high" : "medium",
        status: t.status === "pending" ? "pending" : "in_progress",
        created_at: t.created_at, _dept: t.equipment?.departments?.name,
      }));
    },
  });

  // Pull fire check abnormal items
  const { data: fireIssues = [] } = useQuery({
    queryKey: ["fire-check-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("fire_extinguisher_checks")
        .select("id, checked_at, notes, pressure_ok, condition_ok, fire_extinguishers(code, location, departments(name))")
        .or("pressure_ok.eq.false,condition_ok.eq.false")
        .order("checked_at", { ascending: false }).limit(100);
      return (data || []).map((c: any) => ({
        id: `fire_${c.id}`,
        title: `ถังดับเพลิง ${c.fire_extinguishers?.code || "-"} - พบปัญหา`,
        description: `ตำแหน่ง: ${c.fire_extinguishers?.location || "-"}${!c.pressure_ok ? " | ความดันไม่ปกติ" : ""}${!c.condition_ok ? " | สภาพไม่ปกติ" : ""}${c.notes ? ` | ${c.notes}` : ""}`,
        source_module: "fire_check", source_id: c.id,
        severity: "high", status: "pending",
        created_at: c.checked_at || new Date().toISOString(),
        _dept: c.fire_extinguishers?.departments?.name,
      }));
    },
  });

  // Pull 5S audit low-score items
  const { data: fiveSIssues = [] } = useQuery({
    queryKey: ["5s-issues"],
    queryFn: async () => {
      const { data } = await supabase.from("audit_5s")
        .select("id, total_score, auditor_name, created_at, departments(name)")
        .lt("total_score", 60)
        .order("created_at", { ascending: false }).limit(50);
      return (data || []).map((a: any) => ({
        id: `5s_${a.id}`,
        title: `คะแนน 5ส ต่ำ: ${a.total_score}% - ${a.departments?.name || "ไม่ระบุ"}`,
        description: `ผู้ตรวจ: ${a.auditor_name || "-"} | คะแนน ${a.total_score}% (ต่ำกว่าเกณฑ์ 60%)`,
        source_module: "5s", source_id: a.id,
        severity: a.total_score < 40 ? "high" : "medium", status: "pending",
        created_at: a.created_at, _dept: a.departments?.name,
      }));
    },
  });

  // Merge all issues
  const allIssues = useMemo(() => {
    const dbIssues = issues.map((i: any) => ({ ...i, _source: "db" }));
    const virtuals = [...envAbnormal, ...repairIssues, ...fireIssues, ...fiveSIssues].filter(
      (v) => !issues.some((i: any) => i.source_module === v.source_module && i.source_id === v.source_id)
    ).map((v) => ({ ...v, _source: "virtual" }));
    const merged = [...dbIssues, ...virtuals];

    return merged
      .filter((i) => {
        if (filterStatus !== "all" && i.status !== filterStatus) return false;
        if (filterSeverity !== "all" && i.severity !== filterSeverity) return false;
        return true;
      })
      .sort((a, b) => {
        const sa = SEVERITY_CONFIG[a.severity]?.order ?? 9;
        const sb = SEVERITY_CONFIG[b.severity]?.order ?? 9;
        if (sa !== sb) return sa - sb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  }, [issues, envAbnormal, repairIssues, fireIssues, fiveSIssues, filterStatus, filterSeverity]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const update: any = { status, updated_at: new Date().toISOString() };
      if (status === "resolved") { update.resolved_at = new Date().toISOString(); update.resolved_by = user?.id; }
      const { error } = await supabase.from("issues").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัพเดตสถานะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["issues"] });
      setSelected(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  // For virtual issues, create a DB record first then update
  const handleStatusChange = (issue: any, newStatus: string) => {
    if (issue._source === "virtual") {
      // Create DB record first
      supabase.from("issues").insert({
        title: issue.title, description: issue.description,
        source_module: issue.source_module, source_id: issue.source_id,
        severity: issue.severity, status: newStatus,
        created_by: user?.id,
        resolved_at: newStatus === "resolved" ? new Date().toISOString() : null,
        resolved_by: newStatus === "resolved" ? user?.id : null,
      }).then(({ error }) => {
        if (error) toast.error(error.message);
        else {
          toast.success("อัพเดตสถานะสำเร็จ");
          queryClient.invalidateQueries({ queryKey: ["issues"] });
          setSelected(null);
        }
      });
    } else {
      updateStatus.mutate({ id: issue.id, status: newStatus });
    }
  };

  const counts = useMemo(() => ({
    pending: allIssues.filter(i => i.status === "pending").length,
    in_progress: allIssues.filter(i => i.status === "in_progress").length,
    resolved: allIssues.filter(i => i.status === "resolved").length,
  }), [allIssues]);

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="จัดการปัญหา" subtitle="Issue Management — รวบรวมปัญหาจากทุกระบบ" gradient="from-red-50/80 to-amber-50/80" />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-white rounded-2xl shadow-card border-0 border-t-4 border-t-red-500">
          <CardContent className="p-3 md:p-4 text-center">
            <Clock className="h-5 w-5 text-red-500 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-red-600">{counts.pending}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">รอการจัดการ</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-card border-0 border-t-4 border-t-amber-500">
          <CardContent className="p-3 md:p-4 text-center">
            <Loader2 className="h-5 w-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-amber-600">{counts.in_progress}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">กำลังดำเนินการ</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-card border-0 border-t-4 border-t-emerald-500">
          <CardContent className="p-3 md:p-4 text-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-extrabold text-emerald-600">{counts.resolved}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">แก้ไขแล้ว</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-10 w-36 rounded-2xl text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกสถานะ</SelectItem>
            <SelectItem value="pending">รอการจัดการ</SelectItem>
            <SelectItem value="in_progress">กำลังดำเนินการ</SelectItem>
            <SelectItem value="resolved">แก้ไขแล้ว</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="h-10 w-32 rounded-2xl text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกระดับ</SelectItem>
            <SelectItem value="high">สูง</SelectItem>
            <SelectItem value="medium">ปานกลาง</SelectItem>
            <SelectItem value="low">ต่ำ</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-10 px-4 flex items-center rounded-2xl">{allIssues.length} รายการ</Badge>
      </div>

      {/* Issue List */}
      <div className="space-y-2">
        {allIssues.map((issue) => {
          const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.medium;
          const stat = STATUS_CONFIG[issue.status] || STATUS_CONFIG.pending;
          const StatIcon = stat.icon;
          return (
            <Card key={issue.id} className={`rounded-2xl border shadow-card hover:shadow-elevated transition-all cursor-pointer ${sev.bg}`} onClick={() => setSelected(issue)}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${issue.severity === "high" ? "bg-red-100" : issue.severity === "medium" ? "bg-amber-100" : "bg-green-100"}`}>
                  <AlertTriangle className={`h-5 w-5 ${sev.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{issue.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] rounded-full px-2">{MODULE_LABELS[issue.source_module] || issue.source_module}</Badge>
                    <Badge className={`text-[10px] rounded-full px-2 ${stat.color}`}>
                      <StatIcon className="h-3 w-3 mr-0.5" />{stat.label}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] rounded-full px-2 ${sev.color}`}>ความรุนแรง: {sev.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{format(new Date(issue.created_at), "d MMM yy HH:mm", { locale: th })}{issue._dept ? ` · ${issue._dept}` : ""}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
        {allIssues.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-card">
            <CardContent className="py-12 text-center text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-emerald-400" />
              <p className="text-base font-medium">ไม่มีปัญหาค้างอยู่ 🎉</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">รายละเอียดปัญหา</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className={`rounded-2xl p-4 ${SEVERITY_CONFIG[selected.severity]?.bg || "bg-slate-50"}`}>
                <p className="text-base font-bold">{selected.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{selected.description || "-"}</p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs rounded-full">{MODULE_LABELS[selected.source_module] || selected.source_module}</Badge>
                  <Badge variant="outline" className={`text-xs rounded-full ${SEVERITY_CONFIG[selected.severity]?.color}`}>ความรุนแรง: {SEVERITY_CONFIG[selected.severity]?.label}</Badge>
                  {selected._dept && <Badge variant="outline" className="text-xs rounded-full">{selected._dept}</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{format(new Date(selected.created_at), "d MMMM yyyy HH:mm น.", { locale: th })}</p>
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
                        <cfg.icon className="h-4 w-4 mr-2" />
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