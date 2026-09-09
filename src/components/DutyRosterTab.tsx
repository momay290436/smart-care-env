import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { format, addMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Users, Pencil, Droplets, Waves, Moon, FileDown } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";

const SHIFTS = [
  { key: "water_morning", label: "เวรประปา (เช้า)", short: "ประปา เช้า", icon: Droplets, color: "bg-blue-500", soft: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "wastewater_morning", label: "เวรบ่อบำบัด (เช้า)", short: "บ่อบำบัด เช้า", icon: Waves, color: "bg-emerald-500", soft: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "night_both", label: "เวรดึก (ประปา + บ่อบำบัด)", short: "เวรดึก", icon: Moon, color: "bg-indigo-500", soft: "bg-indigo-50 text-indigo-700 border-indigo-200" },
] as const;

type ShiftKey = (typeof SHIFTS)[number]["key"];

const dStr = (d: Date) => format(d, "yyyy-MM-dd");

export default function DutyRosterTab() {
  const { isAdmin, user } = useAuth();
  const qc = useQueryClient();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [staffOpen, setStaffOpen] = useState(false);

  const from = dStr(startOfMonth(month));
  const to = dStr(endOfMonth(month));

  const { data: staff = [] } = useQuery({
    queryKey: ["duty-staff"],
    queryFn: async () => {
      const { data, error } = await supabase.from("duty_staff").select("*").order("sort_order").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["duty-assignments", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("duty_assignments")
        .select("*, duty_staff(full_name, phone)")
        .gte("duty_date", from)
        .lte("duty_date", to);
      if (error) throw error;
      return data as any[];
    },
  });

  const days = useMemo(() => eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) }), [month]);

  const byDate = useMemo(() => {
    const m: Record<string, Record<string, any>> = {};
    assignments.forEach((a) => {
      m[a.duty_date] = m[a.duty_date] || {};
      m[a.duty_date][a.shift_type] = a;
    });
    return m;
  }, [assignments]);

  // --- assign dialog ---
  const [editing, setEditing] = useState<{ date: string; shift: ShiftKey; id?: string; staffId: string; notes: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const saveAssign = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      if (editing.id) {
        const { error } = await supabase
          .from("duty_assignments")
          .update({ staff_id: editing.staffId, notes: editing.notes || null })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("duty_assignments").insert({
          duty_date: editing.date,
          shift_type: editing.shift,
          staff_id: editing.staffId,
          notes: editing.notes || null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกเวรสำเร็จ");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["duty-assignments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delAssign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("duty_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบเวรสำเร็จ");
      qc.invalidateQueries({ queryKey: ["duty-assignments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    const rows = days.map((d) => {
      const key = dStr(d);
      const row: Record<string, any> = { วันที่: format(d, "d MMM yyyy", { locale: th }) };
      SHIFTS.forEach((s) => {
        row[s.label] = byDate[key]?.[s.key]?.duty_staff?.full_name || "-";
      });
      return row;
    });
    exportToExcel(rows, `ตารางเวร-${format(month, "yyyy-MM")}`, "ตารางเวร");
  };

  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="rounded-3xl border-0 shadow-lg bg-white">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-10 w-10 rounded-2xl bg-cyan-500 flex items-center justify-center shrink-0">
                <CalendarDays className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-800 text-sm md:text-base truncate">ตารางการปฏิบัติงาน (เวร)</p>
                <p className="text-[11px] text-slate-500">ประปา • บ่อบำบัด • เวรดึก</p>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <Button size="sm" variant="outline" className="rounded-xl h-9" onClick={handleExport}>
                <FileDown className="h-4 w-4" />
              </Button>
              {isAdmin && (
                <Button size="sm" className="rounded-xl h-9 bg-cyan-600 hover:bg-cyan-700" onClick={() => setStaffOpen(true)}>
                  <Users className="h-4 w-4 mr-1" /> เจ้าหน้าที่
                </Button>
              )}
            </div>
          </div>

          {/* month nav */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-2">
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setMonth(addMonths(month, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <p className="font-bold text-slate-800">{format(month, "MMMM yyyy", { locale: th })}</p>
            <Button size="icon" variant="ghost" className="h-9 w-9 rounded-xl" onClick={() => setMonth(addMonths(month, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SHIFTS.map((s) => (
              <Badge key={s.key} variant="outline" className={`rounded-full text-[11px] ${s.soft}`}>
                <s.icon className="h-3 w-3 mr-1" />
                {s.short}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily list */}
      <div className="space-y-2">
        {days.map((d) => {
          const key = dStr(d);
          const isToday = isSameDay(d, today);
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
          return (
            <Card
              key={key}
              className={`rounded-2xl border-0 shadow-sm ${isToday ? "ring-2 ring-cyan-400 bg-cyan-50/40" : isWeekend ? "bg-slate-50" : "bg-white"}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-9 w-9 rounded-xl flex flex-col items-center justify-center shrink-0 ${isToday ? "bg-cyan-500 text-white" : "bg-slate-100 text-slate-700"}`}>
                    <span className="text-sm font-bold leading-none">{format(d, "d")}</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-600">
                    {format(d, "EEEE", { locale: th })}
                    {isToday && <span className="ml-1 text-cyan-600">• วันนี้</span>}
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3">
                  {SHIFTS.map((s) => {
                    const a = byDate[key]?.[s.key];
                    return (
                      <div key={s.key} className={`rounded-xl border p-2 ${s.soft}`}>
                        <div className="flex items-center gap-1 mb-1">
                          <s.icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="text-[11px] font-semibold truncate">{s.short}</span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-sm font-medium truncate ${a ? "text-slate-800" : "text-slate-400"}`}>
                            {a?.duty_staff?.full_name || "ยังไม่กำหนด"}
                          </span>
                          {isAdmin && (
                            <div className="flex shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-lg"
                                onClick={() =>
                                  setEditing({ date: key, shift: s.key, id: a?.id, staffId: a?.staff_id || "", notes: a?.notes || "" })
                                }
                              >
                                {a ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                              </Button>
                              {a && (
                                <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive" onClick={() => setDeleteId(a.id)}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        {a?.notes && <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{a.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Assign dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {editing && `${SHIFTS.find((s) => s.key === editing.shift)?.label} • ${format(new Date(`${editing.date}T00:00:00`), "d MMM yyyy", { locale: th })}`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">เจ้าหน้าที่</Label>
              <Select value={editing?.staffId || ""} onValueChange={(v) => setEditing((e) => (e ? { ...e, staffId: v } : e))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="เลือกเจ้าหน้าที่" /></SelectTrigger>
                <SelectContent>
                  {staff.filter((s: any) => s.is_active).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">หมายเหตุ</Label>
              <Textarea
                className="rounded-xl"
                rows={2}
                value={editing?.notes || ""}
                onChange={(e) => setEditing((p) => (p ? { ...p, notes: e.target.value } : p))}
              />
            </div>
            <Button
              className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700"
              disabled={!editing?.staffId || saveAssign.isPending}
              onClick={() => saveAssign.mutate()}
            >
              บันทึก
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <StaffDialog open={staffOpen} onOpenChange={setStaffOpen} staff={staff as any[]} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบเวรนี้?"
        description="ข้อมูลการมอบหมายเวรนี้จะถูกลบถาวร"
        onConfirm={() => {
          if (deleteId) delAssign.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}

function StaffDialog({ open, onOpenChange, staff }: { open: boolean; onOpenChange: (o: boolean) => void; staff: any[] }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("duty_staff").insert({
        full_name: name.trim(),
        phone: phone.trim() || null,
        sort_order: staff.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("เพิ่มเจ้าหน้าที่สำเร็จ");
      setName(""); setPhone("");
      qc.invalidateQueries({ queryKey: ["duty-staff"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("duty_staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบเจ้าหน้าที่สำเร็จ");
      qc.invalidateQueries({ queryKey: ["duty-staff"] });
      qc.invalidateQueries({ queryKey: ["duty-assignments"] });
    },
    onError: (e: any) => toast.error("ลบไม่สำเร็จ อาจมีเวรที่มอบหมายไว้อยู่"),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("duty_staff").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["duty-staff"] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">รายชื่อเจ้าหน้าที่เข้าเวร</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-2xl bg-slate-50 p-3 space-y-2">
              <Input className="rounded-xl bg-white" placeholder="ชื่อ-สกุล" value={name} onChange={(e) => setName(e.target.value)} />
              <Input className="rounded-xl bg-white" placeholder="เบอร์โทร (ไม่บังคับ)" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Button className="w-full rounded-xl bg-cyan-600 hover:bg-cyan-700" disabled={!name.trim() || add.isPending} onClick={() => add.mutate()}>
                <Plus className="h-4 w-4 mr-1" /> เพิ่มเจ้าหน้าที่
              </Button>
            </div>

            {staff.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl border p-2">
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${s.is_active ? "text-slate-800" : "text-slate-400 line-through"}`}>{s.full_name}</p>
                  {s.phone && <p className="text-[10px] text-slate-500">{s.phone}</p>}
                </div>
                <div className="flex shrink-0">
                  <Button size="sm" variant="ghost" className="h-8 rounded-lg text-[11px]" onClick={() => toggle.mutate({ id: s.id, active: !s.is_active })}>
                    {s.is_active ? "พักงาน" : "ใช้งาน"}
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive" onClick={() => setDeleteId(s.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            {staff.length === 0 && <p className="text-center text-xs text-slate-400 py-4">ยังไม่มีรายชื่อเจ้าหน้าที่</p>}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบเจ้าหน้าที่?"
        description="รายชื่อนี้จะถูกลบออกจากระบบ"
        onConfirm={() => {
          if (deleteId) del.mutate(deleteId);
          setDeleteId(null);
        }}
      />
    </>
  );
}
