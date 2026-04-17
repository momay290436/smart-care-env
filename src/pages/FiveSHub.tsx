import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { ClipboardCheck, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, History, Sparkles } from "lucide-react";

const EVENT_COLORS = [
  { value: "#0891b2", label: "ฟ้าน้ำทะเล" },
  { value: "#10b981", label: "เขียว" },
  { value: "#f59e0b", label: "เหลือง" },
  { value: "#ef4444", label: "แดง" },
  { value: "#8b5cf6", label: "ม่วง" },
  { value: "#ec4899", label: "ชมพู" },
];

function getGrade(score: number) {
  if (score >= 80) return { label: "ดีมาก", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (score >= 50) return { label: "พอใช้", color: "bg-amber-100 text-amber-700 border-amber-200" };
  return { label: "ต้องปรับปรุง", color: "bg-red-100 text-red-700 border-red-200" };
}

export default function FiveSHub() {
  const navigate = useNavigate();
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDeptId, setEventDeptId] = useState("");
  const [eventDate, setEventDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [eventEndDate, setEventEndDate] = useState("");
  const [eventColor, setEventColor] = useState("#0891b2");
  const [eventNotes, setEventNotes] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["5s-events", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const { data } = await supabase
        .from("schedule_events")
        .select("*, departments(name)")
        .eq("event_type", "5s")
        .gte("start_date", start)
        .lte("start_date", end)
        .order("start_date");
      return data || [];
    },
  });

  const { data: recentAudits = [] } = useQuery({
    queryKey: ["recent-5s-audits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_5s")
        .select("*, departments(name)")
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_events").insert({
        title: eventTitle, event_type: "5s", department_id: eventDeptId || null,
        start_date: eventDate, end_date: eventEndDate || null,
        color: eventColor, notes: eventNotes || null, created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มกิจกรรมสำเร็จ");
      setShowAddEvent(false);
      setEventTitle(""); setEventDeptId(""); setEventNotes("");
      queryClient.invalidateQueries({ queryKey: ["5s-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("schedule_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ลบกิจกรรมสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["5s-events"] }); },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    return events.filter((e: any) => isSameDay(new Date(e.start_date), selectedDate));
  }, [events, selectedDate]);

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="ระบบ 5ส." subtitle="ตรวจ 5ส · ปฏิทินกำหนดการ · ประวัติการตรวจ" gradient="from-teal-50/80 to-cyan-50/80" />

      {/* 60/40 Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Calendar - 60% */}
        <Card className="lg:col-span-3 bg-white rounded-3xl shadow-md border-0 backdrop-blur-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-primary" /> ปฏิทินกำหนดการ 5ส
              </CardTitle>
              {isAdmin && (
                <Button size="sm" className="rounded-2xl gap-1 h-9" onClick={() => setShowAddEvent(true)}>
                  <Plus className="h-4 w-4" /> เพิ่มกิจกรรม
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h3 className="text-base font-bold text-foreground">{format(currentMonth, "MMMM yyyy", { locale: th })}</h3>
              <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
                <div key={d} className="text-xs font-semibold text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startDayOfWeek }).map((_, i) => <div key={`empty-${i}`} />)}
              {days.map((day) => {
                const dayEvents = events.filter((e: any) => isSameDay(new Date(e.start_date), day));
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                return (
                  <button
                    key={day.toISOString()}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-sm transition-all
                      ${isToday ? "bg-primary/10 font-bold text-primary" : "hover:bg-muted/50"}
                      ${isSelected ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span>{format(day, "d")}</span>
                    {dayEvents.length > 0 && (
                      <div className="flex gap-0.5 mt-0.5">
                        {dayEvents.slice(0, 3).map((e: any, i: number) => (
                          <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: e.color || "#0891b2" }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {selectedDate && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <p className="text-sm font-semibold text-foreground">{format(selectedDate, "d MMMM yyyy", { locale: th })}</p>
                {selectedDateEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีกิจกรรม</p>
                ) : (
                  selectedDateEvents.map((e: any) => (
                    <div key={e.id} className="flex items-center gap-3 rounded-xl p-3 bg-muted/30">
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: e.color || "#0891b2" }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{e.title}</p>
                        <p className="text-xs text-muted-foreground">{e.departments?.name || "ทุกแผนก"}</p>
                        {e.notes && <p className="text-xs text-muted-foreground mt-0.5">{e.notes}</p>}
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteEventId(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right side - 40%: Action button + History */}
        <div className="lg:col-span-2 space-y-4">
          {/* Action card with glassmorphism */}
          <Card
            className="cursor-pointer rounded-3xl border-0 shadow-lg bg-gradient-to-br from-teal-400/90 to-cyan-500/90 backdrop-blur-md hover:shadow-2xl transition-all active:scale-[0.97] overflow-hidden relative"
            onClick={() => navigate("/5s")}
          >
            <div className="absolute inset-0 bg-white/10" />
            <CardContent className="p-6 relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/30 backdrop-blur flex items-center justify-center shadow-inner">
                <ClipboardCheck className="h-7 w-7 text-white" />
              </div>
              <div className="flex-1 text-white">
                <p className="text-lg font-bold flex items-center gap-1">ตรวจ 5ส <Sparkles className="h-4 w-4" /></p>
                <p className="text-sm text-white/90">เริ่มประเมินใหม่</p>
              </div>
              <ChevronRight className="h-5 w-5 text-white" />
            </CardContent>
          </Card>

          {/* History */}
          <Card className="rounded-3xl border-0 shadow-md bg-white/80 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <History className="h-4 w-4 text-primary" /> ประวัติการตรวจล่าสุด
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 space-y-2 max-h-[480px] overflow-y-auto">
              {recentAudits.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">ยังไม่มีประวัติการตรวจ</p>
              ) : (
                recentAudits.map((a: any) => {
                  const grade = getGrade(Number(a.total_score));
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedAudit(a)}
                      className="w-full text-left rounded-2xl p-3 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/60 shadow-sm hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{a.departments?.name || "-"}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="text-base font-bold text-primary">{a.total_score}%</span>
                          <Badge className={`text-[10px] rounded-lg px-1.5 py-0 ${grade.color}`} variant="outline">{grade.label}</Badge>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={(o) => !o && setSelectedAudit(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle>รายละเอียดการตรวจ 5ส</DialogTitle></DialogHeader>
          {selectedAudit && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-gradient-to-r from-teal-50 to-cyan-50 p-4 space-y-1">
                <p className="text-sm"><strong>แผนก:</strong> {selectedAudit.departments?.name || "-"}</p>
                <p className="text-sm"><strong>วันที่:</strong> {new Date(selectedAudit.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                {(selectedAudit.score_json as any)?.auditor_name && (
                  <p className="text-sm"><strong>ผู้ตรวจ:</strong> {(selectedAudit.score_json as any).auditor_name}</p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-2xl font-bold text-primary">{selectedAudit.total_score}%</span>
                  <Badge className={getGrade(Number(selectedAudit.total_score)).color}>{getGrade(Number(selectedAudit.total_score)).label}</Badge>
                </div>
              </div>
              {["seiri", "seiton", "seiso", "seiketsu", "shitsuke"].map((k) => {
                const sj = selectedAudit.score_json as Record<string, number>;
                const labels: Record<string, string> = { seiri: "สะสาง", seiton: "สะดวก", seiso: "สะอาด", seiketsu: "สุขลักษณะ", shitsuke: "สร้างนิสัย" };
                return (
                  <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border/30">
                    <span>{labels[k]}</span>
                    <span className="font-semibold text-primary">{sj?.[k] ?? 0}%</span>
                  </div>
                );
              })}
              {selectedAudit.notes && <div><p className="text-sm font-semibold mb-1">หมายเหตุ</p><p className="text-sm text-muted-foreground">{selectedAudit.notes}</p></div>}
              <Button className="w-full rounded-2xl" onClick={() => navigate("/5s")}>ดูทั้งหมดในหน้าตรวจ 5ส</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>เพิ่มกิจกรรม 5ส</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>ชื่อกิจกรรม</Label><Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="เช่น ตรวจ 5ส แผนกผู้ป่วยใน" className="h-12 rounded-2xl" /></div>
            <div><Label>แผนก</Label>
              <Select value={eventDeptId} onValueChange={setEventDeptId}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="ทุกแผนก" /></SelectTrigger>
                <SelectContent><SelectItem value="">ทุกแผนก</SelectItem>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>วันเริ่ม</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-12 rounded-2xl" /></div>
              <div><Label>วันสิ้นสุด</Label><Input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="h-12 rounded-2xl" /></div>
            </div>
            <div><Label>สี</Label>
              <div className="flex gap-2 mt-1">
                {EVENT_COLORS.map((c) => (
                  <button key={c.value} className={`h-8 w-8 rounded-full border-2 transition-all ${eventColor === c.value ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c.value }} onClick={() => setEventColor(c.value)} />
                ))}
              </div>
            </div>
            <div><Label>หมายเหตุ</Label><Textarea value={eventNotes} onChange={(e) => setEventNotes(e.target.value)} rows={2} className="rounded-2xl" /></div>
            <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => addEvent.mutate()} disabled={!eventTitle || !eventDate || addEvent.isPending}>
              {addEvent.isPending ? "กำลังบันทึก..." : "บันทึกกิจกรรม"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteEventId}
        onOpenChange={(o) => !o && setDeleteEventId(null)}
        title="ลบกิจกรรม"
        description="คุณแน่ใจหรือไม่ว่าต้องการลบกิจกรรมนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteEventId) { deleteEvent.mutate(deleteEventId); setDeleteEventId(null); } }}
      />
    </div>
  );
}
