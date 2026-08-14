import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import DateRangeFilter from "@/components/DateRangeFilter";
import { exportToExcel } from "@/lib/exportExcel";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Pencil, Trash2, Download, Settings2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const ITEM_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#64748b"];

const bkkNow = () => new Date(Date.now() + 7 * 3600 * 1000);
const todayStr = () => bkkNow().toISOString().slice(0, 10);
const timeStr = () => bkkNow().toISOString().slice(11, 16);
const roundFromTime = (t: string) => (Number((t || "00:00").slice(0, 2)) < 12 ? "morning" : "evening");
const roundLabel = (r: string) => (r === "morning" ? "เช้า" : "เย็น");

const emptyLog = {
  id: "",
  record_date: "",
  record_time: "",
  round: "morning",
  weight_kg: "",
  items: [] as string[],
  other_item: "",
  recorder_name: "",
  notes: "",
};

function useTrashOptions() {
  return useQuery({
    queryKey: ["sewage-trash-options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sewage_trash_options").select("id, label, sort_order").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });
}

function useTrashLogs() {
  return useQuery({
    queryKey: ["sewage-trash-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sewage_trash_logs")
        .select("*")
        .order("record_date", { ascending: false })
        .order("record_time", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

function OptionsManager({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const { data: options = [] } = useTrashOptions();
  const [label, setLabel] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sewage-trash-options"] });

  const add = useMutation({
    mutationFn: async () => {
      if (!label.trim()) throw new Error("กรุณาระบุชื่อรายการ");
      const { error } = await supabase.from("sewage_trash_options").insert({ label: label.trim(), sort_order: options.length + 1 });
      if (error) throw error;
    },
    onSuccess: () => { setLabel(""); invalidate(); toast.success("เพิ่มตัวเลือกสำเร็จ"); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sewage_trash_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("ลบตัวเลือกสำเร็จ"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-md w-[95vw]">
        <DialogHeader><DialogTitle>จัดการตัวเลือกขยะที่พบ</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="เช่น ถุงพลาสติก" className="h-11 rounded-2xl flex-1" />
            <Button className="h-11 rounded-2xl" onClick={() => add.mutate()} disabled={add.isPending}>เพิ่ม</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {options.map((o: any) => (
              <Badge key={o.id} variant="secondary" className="rounded-xl text-sm py-1.5 pl-3 pr-1.5 gap-1">
                {o.label}
                <button className="text-destructive hover:opacity-70" onClick={() => remove.mutate(o.id)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </Badge>
            ))}
            {options.length === 0 && <p className="text-sm text-muted-foreground">ยังไม่มีตัวเลือก</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SewageTrashDialog({
  open,
  onOpenChange,
  editLog,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editLog?: any | null;
}) {
  const queryClient = useQueryClient();
  const { profile, isAdmin } = useAuth();
  const { data: options = [] } = useTrashOptions();
  const { data: logs = [] } = useTrashLogs();
  const [form, setForm] = useState({ ...emptyLog });
  const [showOptions, setShowOptions] = useState(false);
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editLog) {
      setForm({
        id: editLog.id,
        record_date: editLog.record_date,
        record_time: (editLog.record_time || "").slice(0, 5),
        round: editLog.round || "morning",
        weight_kg: String(editLog.weight_kg ?? ""),
        items: editLog.items || [],
        other_item: editLog.other_item || "",
        recorder_name: editLog.recorder_name || "",
        notes: editLog.notes || "",
      });
      setShowOther(!!editLog.other_item);
    } else {
      const t = timeStr();
      setForm({ ...emptyLog, record_date: todayStr(), record_time: t, round: roundFromTime(t), recorder_name: profile?.full_name || "" });
      setShowOther(false);
    }
  }, [open, editLog, profile?.full_name]);

  const dailyTotal = useMemo(() => {
    const others = logs
      .filter((l: any) => l.record_date === form.record_date && l.id !== form.id)
      .reduce((s: number, l: any) => s + Number(l.weight_kg || 0), 0);
    return others + (Number(form.weight_kg) || 0);
  }, [logs, form.record_date, form.weight_kg, form.id]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.record_date) throw new Error("กรุณาเลือกวันที่");
      if (form.weight_kg === "" || Number.isNaN(Number(form.weight_kg))) throw new Error("กรุณากรอกปริมาณขยะ");
      const payload = {
        record_date: form.record_date,
        record_time: form.record_time || timeStr(),
        round: form.round,
        weight_kg: Number(form.weight_kg),
        items: form.items,
        other_item: showOther ? form.other_item.trim() || null : null,
        recorder_name: form.recorder_name.trim() || profile?.full_name || null,
        notes: form.notes.trim() || null,
      };
      if (form.id) {
        const { error } = await supabase.from("sewage_trash_logs").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sewage_trash_logs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกขยะตะแกรงดักสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["sewage-trash-logs"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItem = (label: string) =>
    setForm((f) => ({ ...f, items: f.items.includes(label) ? f.items.filter((x) => x !== label) : [...f.items, label] }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="rounded-3xl max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🗑️ {form.id ? "แก้ไขบันทึกขยะตะแกรงดัก" : "บันทึกขยะตะแกรงดักบ่อสูบน้ำเสีย"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">วันที่</Label>
                <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} className="h-11 rounded-2xl mt-1" />
              </div>
              <div>
                <Label className="text-sm font-semibold">เวลา</Label>
                <Input type="time" value={form.record_time} onChange={(e) => setForm({ ...form, record_time: e.target.value, round: roundFromTime(e.target.value) })} className="h-11 rounded-2xl mt-1" />
              </div>
            </div>

            <div>
              <Label className="text-sm font-semibold">รอบการบันทึก</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {(["morning", "evening"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm({ ...form, round: r })}
                    className={cn(
                      "h-11 rounded-2xl border text-sm font-bold transition-all",
                      form.round === r ? "bg-emerald-600 text-white border-emerald-600 shadow" : "bg-background border-border text-muted-foreground",
                    )}
                  >
                    {r === "morning" ? "🌅 เช้า" : "🌇 เย็น"}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">ปริมาณขยะ (กก.)</Label>
                <Input type="number" step="0.01" inputMode="decimal" value={form.weight_kg} onChange={(e) => setForm({ ...form, weight_kg: e.target.value })} className="h-11 rounded-2xl mt-1" />
              </div>
              <div>
                <Label className="text-sm font-semibold">ผลรวมต่อวัน (กก.)</Label>
                <Input readOnly value={dailyTotal.toFixed(2)} className="h-11 rounded-2xl mt-1 bg-muted font-bold" />
              </div>
            </div>

            <div className="rounded-2xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">สิ่งของ/ขยะที่พบเจอ</Label>
                {isAdmin && (
                  <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1" onClick={() => setShowOptions(true)}>
                    <Settings2 className="h-3.5 w-3.5" /> จัดการตัวเลือก
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {options.map((o: any) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleItem(o.label)}
                    className={cn(
                      "px-3 py-2 rounded-2xl text-sm border transition-all",
                      form.items.includes(o.label) ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-border",
                    )}
                  >
                    {o.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowOther((v) => !v)}
                  className={cn(
                    "px-3 py-2 rounded-2xl text-sm border transition-all",
                    showOther ? "bg-emerald-600 text-white border-emerald-600" : "bg-background border-border",
                  )}
                >
                  อื่นๆ
                </button>
              </div>
              {showOther && (
                <Input value={form.other_item} onChange={(e) => setForm({ ...form, other_item: e.target.value })} placeholder="ระบุเพิ่มเติม" className="h-10 rounded-xl" />
              )}
            </div>

            <div>
              <Label className="text-sm font-semibold">ผู้บันทึก</Label>
              <Input value={form.recorder_name} onChange={(e) => setForm({ ...form, recorder_name: e.target.value })} disabled={!isAdmin} className="h-11 rounded-2xl mt-1" />
            </div>

            <div>
              <Label className="text-sm font-semibold">หมายเหตุ (ปัญหาที่พบ)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-2xl mt-1 min-h-[80px]" />
            </div>

            <Button className="w-full h-12 rounded-2xl font-bold bg-emerald-600 hover:bg-emerald-700" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <OptionsManager open={showOptions} onOpenChange={setShowOptions} />
    </>
  );
}

export function SewageTrashHistory() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: logs = [] } = useTrashLogs();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [editLog, setEditLog] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const dailyTotals = useMemo(() => {
    const map: Record<string, number> = {};
    logs.forEach((l: any) => { map[l.record_date] = (map[l.record_date] || 0) + Number(l.weight_kg || 0); });
    return map;
  }, [logs]);

  const filtered = useMemo(
    () => logs.filter((l: any) => (!from || l.record_date >= from) && (!to || l.record_date <= to)),
    [logs, from, to],
  );

  const chartData = useMemo(() => {
    const map: Record<string, { date: string; morning: number; evening: number; total: number }> = {};
    filtered.forEach((l: any) => {
      const d = l.record_date;
      if (!map[d]) map[d] = { date: d, morning: 0, evening: 0, total: 0 };
      const w = Number(l.weight_kg || 0);
      if (l.round === "evening") map[d].evening += w;
      else map[d].morning += w;
      map[d].total += w;
    });
    return Object.values(map)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, label: format(new Date(d.date), "d MMM", { locale: th }) }));
  }, [filtered]);

  const summary = useMemo(() => {
    const total = filtered.reduce((s: number, l: any) => s + Number(l.weight_kg || 0), 0);
    const morning = filtered.filter((l: any) => l.round !== "evening").reduce((s: number, l: any) => s + Number(l.weight_kg || 0), 0);
    const evening = total - morning;
    const days = new Set(filtered.map((l: any) => l.record_date)).size;
    const counts: Record<string, number> = {};
    filtered.forEach((l: any) => {
      [...(l.items || []), l.other_item].filter(Boolean).forEach((it: string) => { counts[it] = (counts[it] || 0) + 1; });
    });
    const totalItemHits = Object.values(counts).reduce((s, n) => s + n, 0);
    const items = Object.entries(counts)
      .map(([name, count]) => ({ name, count, percent: totalItemHits ? (count / totalItemHits) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);
    return { total, morning, evening, days, items, top: items[0] || null };
  }, [filtered]);

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sewage_trash_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ลบข้อมูลสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["sewage-trash-logs"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const itemsLabel = (l: any) => [...(l.items || []), l.other_item].filter(Boolean).join(", ") || "-";

  const handleExport = () => {
    const rows = [...filtered]
      .sort((a: any, b: any) => (a.record_date + a.record_time).localeCompare(b.record_date + b.record_time))
      .map((l: any) => ({
        "วัน/เดือน/ปี": format(new Date(l.record_date), "d MMM yyyy", { locale: th }),
        "เวลา": (l.record_time || "").slice(0, 5),
        "รอบ": roundLabel(l.round),
        "ปริมาณขยะ (กก.)": Number(l.weight_kg || 0),
        "ผลรวมขยะต่อวัน (กก.)": Number((dailyTotals[l.record_date] || 0).toFixed(2)),
        "ขยะหรือสิ่งของที่พบเจอ": itemsLabel(l),
        "ผู้บันทึก": l.recorder_name || "-",
        "หมายเหตุ": l.notes || "-",
      }));
    if (rows.length === 0) { toast.error("ไม่มีข้อมูลสำหรับส่งออก"); return; }
    exportToExcel(rows, "sewage-trash", "ขยะตะแกรงดักบ่อสูบ");
    toast.success("ส่งออก Excel สำเร็จ");
  };

  return (
    <div className="space-y-3">
      {filtered.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-border bg-emerald-50 dark:bg-emerald-950/30 p-3">
              <p className="text-xs text-muted-foreground">ปริมาณรวมช่วงที่เลือก</p>
              <p className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{summary.total.toFixed(2)} <span className="text-sm">กก.</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.days} วัน · เฉลี่ย {(summary.days ? summary.total / summary.days : 0).toFixed(2)} กก./วัน</p>
            </div>
            <div className="rounded-2xl border border-border bg-amber-50 dark:bg-amber-950/30 p-3">
              <p className="text-xs text-muted-foreground">รอบเช้า</p>
              <p className="text-2xl font-black text-amber-700 dark:text-amber-400">{summary.morning.toFixed(2)} <span className="text-sm">กก.</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.total ? ((summary.morning / summary.total) * 100).toFixed(1) : 0}% ของทั้งหมด</p>
            </div>
            <div className="rounded-2xl border border-border bg-sky-50 dark:bg-sky-950/30 p-3">
              <p className="text-xs text-muted-foreground">รอบเย็น</p>
              <p className="text-2xl font-black text-sky-700 dark:text-sky-400">{summary.evening.toFixed(2)} <span className="text-sm">กก.</span></p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary.total ? ((summary.evening / summary.total) * 100).toFixed(1) : 0}% ของทั้งหมด</p>
            </div>
            <div className="rounded-2xl border border-border bg-rose-50 dark:bg-rose-950/30 p-3">
              <p className="text-xs text-muted-foreground">ขยะที่พบบ่อยที่สุด</p>
              <p className="text-xl font-black text-rose-700 dark:text-rose-400 truncate">{summary.top?.name || "-"}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary.top ? `พบ ${summary.top.count} ครั้ง (${summary.top.percent.toFixed(1)}%)` : "ไม่มีข้อมูล"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-2xl border border-border p-3">
              <p className="font-bold text-sm mb-2">แนวโน้มปริมาณขยะตะแกรงดักรายวัน (แยกรอบเช้า-เย็น)</p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit=" กก." width={60} />
                    <Tooltip formatter={(v: any, n: any) => [`${Number(v).toFixed(2)} กก.`, n === "morning" ? "รอบเช้า" : "รอบเย็น"]} />
                    <Legend formatter={(v) => (v === "morning" ? "รอบเช้า" : "รอบเย็น")} />
                    <Bar dataKey="morning" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="evening" stackId="a" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-border p-3">
              <p className="font-bold text-sm mb-2">สัดส่วนชนิดขยะที่พบ</p>
              {summary.items.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">ยังไม่มีข้อมูลชนิดขยะ</p>
              ) : (
                <>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={summary.items} dataKey="count" nameKey="name" innerRadius={35} outerRadius={65} paddingAngle={2}>
                          {summary.items.map((_, i) => (
                            <Cell key={i} fill={ITEM_COLORS[i % ITEM_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v: any, n: any) => [`${v} ครั้ง`, n]} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1 mt-2 max-h-32 overflow-y-auto">
                    {summary.items.slice(0, 6).map((it, i) => (
                      <div key={it.name} className="flex items-center gap-2 text-xs">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: ITEM_COLORS[i % ITEM_COLORS.length] }} />
                        <span className="flex-1 truncate">{it.name}</span>
                        <span className="font-bold">{it.percent.toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <Label className="text-xs text-muted-foreground">กรองตามวันที่</Label>
          <DateRangeFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t); }} className="mt-1" />
        </div>
        <Button size="sm" className="rounded-2xl h-10 bg-slate-950 hover:bg-slate-900 text-white gap-2" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export Excel
        </Button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm min-w-[820px]">
          <thead className="bg-muted/60">
            <tr className="text-left">
              <th className="px-3 py-2 font-semibold">วัน/เดือน/ปี</th>
              <th className="px-3 py-2 font-semibold">เวลา</th>
              <th className="px-3 py-2 font-semibold">รอบ</th>
              <th className="px-3 py-2 font-semibold text-right">ปริมาณ (กก.)</th>
              <th className="px-3 py-2 font-semibold text-right">รวมต่อวัน (กก.)</th>
              <th className="px-3 py-2 font-semibold">ขยะที่พบเจอ</th>
              <th className="px-3 py-2 font-semibold">ผู้บันทึก</th>
              <th className="px-3 py-2 font-semibold">หมายเหตุ</th>
              {isAdmin && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {filtered.map((l: any) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{format(new Date(l.record_date), "d MMM yy", { locale: th })}</td>
                <td className="px-3 py-2 whitespace-nowrap">{(l.record_time || "").slice(0, 5)}</td>
                <td className="px-3 py-2">
                  <Badge variant="secondary" className="rounded-xl text-[11px]">{roundLabel(l.round)}</Badge>
                </td>
                <td className="px-3 py-2 text-right font-semibold">{Number(l.weight_kg || 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right">{(dailyTotals[l.record_date] || 0).toFixed(2)}</td>
                <td className="px-3 py-2 max-w-[220px]">{itemsLabel(l)}</td>
                <td className="px-3 py-2 whitespace-nowrap">{l.recorder_name || "-"}</td>
                <td className="px-3 py-2 max-w-[200px]">{l.notes || "-"}</td>
                {isAdmin && (
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0" onClick={() => { setEditLog(l); setEditOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" className="rounded-xl h-8 w-8 p-0 text-destructive" onClick={() => setDeleteId(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={isAdmin ? 9 : 8} className="px-3 py-8 text-center text-muted-foreground">ยังไม่มีข้อมูล</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <SewageTrashDialog open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditLog(null); }} editLog={editLog} />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบบันทึกขยะตะแกรงดัก"
        description="ยืนยันการลบข้อมูลแถวนี้?"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}

