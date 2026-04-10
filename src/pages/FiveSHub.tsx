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
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, getDay } from "date-fns";
import { th } from "date-fns/locale";
import PageHeader from "@/components/PageHeader";
import { ClipboardCheck, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus } from "lucide-react";

const EVENT_COLORS = [
  { value: "#0891b2", label: "ฟ้าน้ำทะเล" },
  { value: "#10b981", label: "เขียว" },
  { value: "#f59e0b", label: "เหลือง" },
  { value: "#ef4444", label: "แดง" },
  { value: "#8b5cf6", label: "ม่วง" },
  { value: "#ec4899", label: "ชมพู" },
];

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

  const addEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_events").insert({
        title: eventTitle,
        event_type: "5s",
        department_id: eventDeptId || null,
        start_date: eventDate,
        end_date: eventEndDate || null,
        color: eventColor,
        notes: eventNotes || null,
        created_by: user!.id,
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
      <PageHeader title="ระบบ 5ส." subtitle="ตรวจ 5ส · ปฏิทินกำหนดการ" gradient="from-teal-50/80 to-cyan-50/80" />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-1">
        <Card className="cursor-pointer border-t-4 border-t-teal-400 bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all active:scale-[0.97]" onClick={() => navigate("/5s")}>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-400 flex items-center justify-center">
              <ClipboardCheck className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">ตรวจ 5ส</p>
              <p className="text-sm text-muted-foreground">ประเมินและบันทึกผลการตรวจ</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto" />
          </CardContent>
        </Card>
      </div>

      {/* Calendar */}
      <Card className="bg-white rounded-2xl shadow-sm border-0">
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
        <CardContent className="p-4 space-y-4">
          {/* Month Nav */}
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-bold text-foreground">
              {format(currentMonth, "MMMM yyyy", { locale: th })}
            </h3>
            <Button variant="ghost" size="sm" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map((d) => (
              <div key={d} className="text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
          </div>

          {/* Day Grid */}
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
                    ${isSelected ? "ring-2 ring-primary" : ""}
                  `}
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

          {/* Selected Date Events */}
          {selectedDate && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <p className="text-sm font-semibold text-foreground">
                {format(selectedDate, "d MMMM yyyy", { locale: th })}
              </p>
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
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("ลบกิจกรรม?")) deleteEvent.mutate(e.id); }}>✕</Button>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Event Dialog */}
      <Dialog open={showAddEvent} onOpenChange={setShowAddEvent}>
        <DialogContent className="rounded-3xl">
          <DialogHeader><DialogTitle>เพิ่มกิจกรรม 5ส</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>ชื่อกิจกรรม</Label><Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="เช่น ตรวจ 5ส แผนกผู้ป่วยใน" className="h-12 rounded-2xl" /></div>
            <div><Label>แผนก</Label>
              <Select value={eventDeptId} onValueChange={setEventDeptId}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="ทุกแผนก" /></SelectTrigger>
                <SelectContent><SelectItem value="">ทุกแผนก</SelectItem>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>วันเริ่ม</Label><Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="h-12 rounded-2xl" /></div>
              <div><Label>วันสิ้นสุด</Label><Input type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)} className="h-12 rounded-2xl" /></div>
            </div>
            <div><Label>สี</Label>
              <div className="flex gap-2 mt-1">
                {EVENT_COLORS.map(c => (
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
    </div>
  );
}
