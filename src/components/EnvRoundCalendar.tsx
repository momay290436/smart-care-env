import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { th } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Trash2, CalendarDays } from "lucide-react";

export default function EnvRoundCalendar() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [deptId, setDeptId] = useState("");
  const [color, setColor] = useState("#0891b2");
  const [notes, setNotes] = useState("");

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["env-schedule-events", format(currentMonth, "yyyy-MM")],
    queryFn: async () => {
      const start = format(startOfMonth(currentMonth), "yyyy-MM-dd");
      const end = format(endOfMonth(currentMonth), "yyyy-MM-dd");
      const { data } = await supabase.from("schedule_events").select("*, departments(name)")
        .eq("event_type", "env")
        .gte("start_date", start).lte("start_date", end)
        .order("start_date");
      return data || [];
    },
  });

  const addEvent = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("schedule_events").insert({
        title, start_date: startDate, end_date: endDate || null,
        department_id: deptId || null, color, notes: notes || null,
        event_type: "env", created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มกำหนดการสำเร็จ");
      setShowAdd(false); setTitle(""); setStartDate(""); setEndDate(""); setDeptId(""); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["env-schedule-events"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("schedule_events").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["env-schedule-events"] }); },
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const colorOptions = [
    { value: "#0891b2", label: "ฟ้า" },
    { value: "#059669", label: "เขียว" },
    { value: "#d97706", label: "ส้ม" },
    { value: "#dc2626", label: "แดง" },
    { value: "#7c3aed", label: "ม่วง" },
  ];

  return (
    <Card className="border border-slate-200 shadow-lg rounded-2xl bg-white">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg text-foreground">ปฏิทินกำหนดการ ENV Round</h3>
          </div>
          {isAdmin && (
            <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" /> เพิ่ม
            </Button>
          )}
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="rounded-2xl" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h4 className="font-semibold text-base">{format(currentMonth, "MMMM yyyy", { locale: th })}</h4>
          <Button variant="ghost" size="sm" className="rounded-2xl" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"].map(d => (
            <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
          ))}
          {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
          {days.map(day => {
            const dayEvents = events.filter((e: any) => isSameDay(new Date(e.start_date), day));
            const isToday = isSameDay(day, new Date());
            return (
              <div key={day.toISOString()} className={`min-h-[48px] p-1 rounded-xl text-center relative ${isToday ? "bg-primary/10 ring-1 ring-primary" : "hover:bg-muted/50"}`}>
                <span className={`text-xs ${isToday ? "font-bold text-primary" : "text-foreground"}`}>{format(day, "d")}</span>
                <div className="space-y-0.5 mt-0.5">
                  {dayEvents.slice(0, 2).map((ev: any) => (
                    <div key={ev.id} className="rounded-full h-1.5 w-full" style={{ backgroundColor: ev.color || "#0891b2" }} title={ev.title} />
                  ))}
                  {dayEvents.length > 2 && <span className="text-[8px] text-muted-foreground">+{dayEvents.length - 2}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Events list */}
        {events.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-semibold text-foreground">กิจกรรมเดือนนี้</p>
            {events.map((ev: any) => (
              <div key={ev.id} className="flex items-center gap-3 p-3 rounded-2xl bg-muted/30">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ev.color || "#0891b2" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(ev.start_date), "d MMM", { locale: th })} · {ev.departments?.name || "ทุกแผนก"}</p>
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive rounded-2xl" onClick={() => { if (confirm("ยืนยันลบ?")) deleteEvent.mutate(ev.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add event dialog */}
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogContent className="rounded-3xl">
            <DialogHeader><DialogTitle className="text-lg">เพิ่มกำหนดการ ENV Round</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>ชื่อกิจกรรม</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="เช่น ตรวจ ENV ชั้น 2" className="h-12 rounded-2xl" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>วันเริ่มต้น</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-12 rounded-2xl" /></div>
                <div><Label>วันสิ้นสุด</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-12 rounded-2xl" /></div>
              </div>
              <div><Label>แผนก</Label>
                <Select value={deptId} onValueChange={setDeptId}>
                  <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="ทุกแผนก" /></SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="all">ทุกแผนก</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>สี</Label>
                <div className="flex gap-2 mt-1">
                  {colorOptions.map(c => (
                    <button key={c.value} className={`w-8 h-8 rounded-full border-2 ${color === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c.value }} onClick={() => setColor(c.value)} title={c.label} />
                  ))}
                </div>
              </div>
              <div><Label>หมายเหตุ</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="รายละเอียดเพิ่มเติม" className="h-12 rounded-2xl" /></div>
              <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addEvent.mutate()} disabled={!title || !startDate || addEvent.isPending}>
                {addEvent.isPending ? "กำลังบันทึก..." : "เพิ่มกำหนดการ"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
