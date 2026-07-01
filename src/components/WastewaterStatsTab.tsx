import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Plus, Trash2, BarChart3, Pencil } from "lucide-react";
import * as XLSX from "xlsx";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_FIELDS: { key: string; label: string }[] = [
  { key: "treatment_system_status", label: "ระบบบำบัดน้ำเสีย" },
  { key: "water_pump_status", label: "เครื่องสูบน้ำ" },
  { key: "aerator_status", label: "เครื่องเติมอากาศ" },
  { key: "mixer_wastewater_status", label: "เครื่องกวน/ผสมน้ำเสีย" },
  { key: "mixer_chemical_status", label: "เครื่องกวน/ผสมสารเคมี" },
];

/** Insert dialog (4th button - orange) */
export function WastewaterStatsDialog({ open, onOpenChange }: DialogProps) {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<any>({
    record_date: format(new Date(), "yyyy-MM-dd"),
    electricity_usage: "",
    water_usage: "",
    wastewater_volume: "",
    discharge_method: "ระบาย",
    chemical_substances: "",
    chemical_amount: "",
    treatment_system_status: "normal",
    water_pump_status: "normal",
    aerator_status: "normal",
    mixer_wastewater_status: "normal",
    mixer_chemical_status: "normal",
    sludge_pump_used: false,
    sludge_pump_status: "normal",
    other_equipment_status: "",
    excess_sludge_volume: "",
    problems_and_solutions: "",
    notes: "",
    recorder_name: "",
  });

  const insert = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
      const payload: any = {
        record_date: form.record_date,
        electricity_usage: form.electricity_usage ? Number(form.electricity_usage) : null,
        water_usage: form.water_usage ? Number(form.water_usage) : null,
        wastewater_volume: form.wastewater_volume ? Number(form.wastewater_volume) : null,
        discharge_method: form.discharge_method || null,
        chemical_substances: form.chemical_substances || null,
        chemical_amount: form.chemical_amount ? Number(form.chemical_amount) : null,
        treatment_system_status: form.treatment_system_status,
        water_pump_status: form.water_pump_status,
        aerator_status: form.aerator_status,
        mixer_wastewater_status: form.mixer_wastewater_status,
        mixer_chemical_status: form.mixer_chemical_status,
        sludge_pump_used: form.sludge_pump_used,
        sludge_pump_status: form.sludge_pump_status,
        other_equipment_status: form.other_equipment_status || null,
        excess_sludge_volume: form.excess_sludge_volume ? Number(form.excess_sludge_volume) : null,
        problems_and_solutions: form.problems_and_solutions || null,
        notes: form.notes || null,
        recorded_by: user.id,
        recorder_name: (isAdmin && form.recorder_name.trim()) ? form.recorder_name.trim() : (profile?.full_name || ""),
      };
      const { error } = await (supabase as any).from("wastewater_statistics_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกสถิติบำบัดน้ำเสียสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-stats"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const StatusToggle = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-2 gap-1">
      <button type="button" onClick={() => onChange("normal")}
        className={`h-10 rounded-xl text-sm font-semibold border transition ${value === "normal" ? "bg-emerald-500 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}>ปกติ</button>
      <button type="button" onClick={() => onChange("abnormal")}
        className={`h-10 rounded-xl text-sm font-semibold border transition ${value === "abnormal" ? "bg-red-500 text-white border-red-600" : "bg-white text-slate-600 border-slate-200"}`}>ไม่ปกติ</button>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-orange-600" /> บันทึกสถิติและข้อมูลผลการทำงานของระบบบำบัดน้ำเสีย
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-2xl bg-orange-50 p-3 text-sm">
            <p><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold">วัน/เดือน/ปี *</Label>
              <Input type="date" value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">ปริมาณใช้ไฟฟ้า (หน่วย)</Label>
              <Input type="number" step="0.01" value={form.electricity_usage} onChange={(e) => setForm({ ...form, electricity_usage: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">ปริมาณน้ำใช้ (ลบ.ม.)</Label>
              <Input type="number" step="0.01" value={form.water_usage} onChange={(e) => setForm({ ...form, water_usage: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">น้ำเสียเข้าระบบ (ลบ.ม.)</Label>
              <Input type="number" step="0.01" value={form.wastewater_volume} onChange={(e) => setForm({ ...form, wastewater_volume: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">การระบายน้ำทิ้ง</Label>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {["ระบาย", "ไม่ระบาย"].map((opt) => (
                  <button key={opt} type="button" onClick={() => setForm({ ...form, discharge_method: opt })}
                    className={`h-11 rounded-xl text-sm font-semibold border ${form.discharge_method === opt ? "bg-orange-500 text-white border-orange-600" : "bg-white text-slate-600 border-slate-200"}`}>{opt}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold">สารเคมี (ชื่อ)</Label>
              <Input value={form.chemical_substances} onChange={(e) => setForm({ ...form, chemical_substances: e.target.value })} placeholder="เช่น คลอรีน" className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">ปริมาณสารเคมี (ล./กก.)</Label>
              <Input type="number" step="0.01" value={form.chemical_amount} onChange={(e) => setForm({ ...form, chemical_amount: e.target.value })} className="h-11 rounded-2xl" />
            </div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50/40 p-3 space-y-3">
            <p className="text-sm font-bold text-slate-800">สถานะการทำงานของระบบบำบัดน้ำเสีย</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {STATUS_FIELDS.map((f) => (
                <div key={f.key}>
                  <Label className="text-xs font-semibold">{f.label}</Label>
                  <StatusToggle value={form[f.key]} onChange={(v) => setForm({ ...form, [f.key]: v })} />
                </div>
              ))}
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold">เครื่องสูบตะกอน</Label>
                <div className="grid grid-cols-3 gap-1">
                  <button type="button" onClick={() => setForm({ ...form, sludge_pump_used: false })}
                    className={`h-10 rounded-xl text-sm font-semibold border ${!form.sludge_pump_used ? "bg-slate-700 text-white border-slate-700" : "bg-white text-slate-600 border-slate-200"}`}>ไม่มี</button>
                  <button type="button" onClick={() => setForm({ ...form, sludge_pump_used: true, sludge_pump_status: "normal" })}
                    className={`h-10 rounded-xl text-sm font-semibold border ${form.sludge_pump_used && form.sludge_pump_status === "normal" ? "bg-emerald-500 text-white border-emerald-600" : "bg-white text-slate-600 border-slate-200"}`}>ใช้ (ปกติ)</button>
                  <button type="button" onClick={() => setForm({ ...form, sludge_pump_used: true, sludge_pump_status: "abnormal" })}
                    className={`h-10 rounded-xl text-sm font-semibold border ${form.sludge_pump_used && form.sludge_pump_status === "abnormal" ? "bg-red-500 text-white border-red-600" : "bg-white text-slate-600 border-slate-200"}`}>ใช้ (ไม่ปกติ)</button>
                </div>
              </div>
              <div className="md:col-span-2">
                <Label className="text-xs font-semibold">อื่นๆ (ระบุ)</Label>
                <Input value={form.other_equipment_status} onChange={(e) => setForm({ ...form, other_equipment_status: e.target.value })} placeholder="เช่น เครื่องเป่าลม สถานะ..." className="h-11 rounded-2xl" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">ปริมาณตะกอนส่วนเกิน (ลบ.ม.)</Label>
              <Input type="number" step="0.01" value={form.excess_sludge_volume} onChange={(e) => setForm({ ...form, excess_sludge_volume: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">ปัญหา / แนวทางแก้ไข</Label>
              <Input value={form.problems_and_solutions} onChange={(e) => setForm({ ...form, problems_and_solutions: e.target.value })} placeholder="-" className="h-11 rounded-2xl" />
            </div>
          </div>

          {isAdmin && (
            <div>
              <Label className="text-xs font-semibold">ผู้บันทึก (แอดมินแก้ไขได้)</Label>
              <Input value={form.recorder_name} onChange={(e) => setForm({ ...form, recorder_name: e.target.value })} placeholder={profile?.full_name || ""} className="h-11 rounded-2xl" />
            </div>
          )}
          <div>
            <Label className="text-xs font-semibold">หมายเหตุ</Label>
            <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="rounded-2xl" />
          </div>
          <Button className="w-full h-12 rounded-2xl text-base font-bold bg-orange-600 hover:bg-orange-700" disabled={insert.isPending} onClick={() => insert.mutate()}>
            {insert.isPending ? "กำลังบันทึก..." : "บันทึกสถิติ"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** History view + client-side Excel export */
export default function WastewaterStatsHistory() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showAll, setShowAll] = useState(false);
  const [editRow, setEditRow] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const { data: rows = [] } = useQuery({
    queryKey: ["wastewater-stats"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wastewater_statistics_logs")
        .select("*")
        .order("record_date", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (showAll) return rows;
    return (rows as any[]).filter((r) => (r.record_date || "").startsWith(filterMonth));
  }, [rows, filterMonth, showAll]);

  const totals = useMemo(() => {
    return (filtered as any[]).reduce((acc, r) => ({
      electricity: acc.electricity + Number(r.electricity_usage || 0),
      water: acc.water + Number(r.water_usage || 0),
      wastewater: acc.wastewater + Number(r.wastewater_volume || 0),
      chem: acc.chem + Number(r.chemical_amount || 0),
    }), { electricity: 0, water: 0, wastewater: 0, chem: 0 });
  }, [filtered]);

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("wastewater_statistics_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-stats"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const upd = useMutation({
    mutationFn: async () => {
      const payload: any = {
        record_date: editForm.record_date,
        electricity_usage: editForm.electricity_usage !== "" ? Number(editForm.electricity_usage) : null,
        water_usage: editForm.water_usage !== "" ? Number(editForm.water_usage) : null,
        wastewater_volume: editForm.wastewater_volume !== "" ? Number(editForm.wastewater_volume) : null,
        chemical_substances: editForm.chemical_substances || null,
        chemical_amount: editForm.chemical_amount !== "" ? Number(editForm.chemical_amount) : null,
        recorder_name: editForm.recorder_name || null,
        notes: editForm.notes || null,
        problems_and_solutions: editForm.problems_and_solutions || null,
      };
      const { error } = await (supabase as any).from("wastewater_statistics_logs").update(payload).eq("id", editRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("แก้ไขสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-stats"] });
      setEditRow(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    if (filtered.length === 0) { toast.info("ไม่มีข้อมูลให้ส่งออก"); return; }
    const headers = [
      "วัน/เดือน/ปี", "ปริมาณไฟฟ้า", "ปริมาณน้ำใช้ (ลบ.ม.)", "น้ำเสียเข้าระบบ (ลบ.ม.)",
      "การระบายน้ำทิ้ง", "สารเคมี", "ปริมาณสารเคมี",
      "ระบบบำบัด", "เครื่องสูบน้ำ", "เครื่องเติมอากาศ",
      "เครื่องกวน/ผสมน้ำเสีย", "เครื่องกวน/ผสมสารเคมี",
      "เครื่องสูบตะกอน", "อื่นๆ", "ปริมาณตะกอนส่วนเกิน",
      "ปัญหา/แนวทางแก้ไข", "ผู้บันทึก", "หมายเหตุ",
    ];
    const statusTh = (v: string) => v === "normal" ? "ปกติ" : v === "abnormal" ? "ผิดปกติ" : "-";
    const dataRows = [...(filtered as any[])]
      .sort((a, b) => (a.record_date || "").localeCompare(b.record_date || ""))
      .map((r) => [
        r.record_date ? new Date(r.record_date).toLocaleDateString("th-TH") : "-",
        r.electricity_usage ?? "-",
        r.water_usage ?? "-",
        r.wastewater_volume ?? "-",
        r.discharge_method || "-",
        r.chemical_substances || "-",
        r.chemical_amount ?? "-",
        statusTh(r.treatment_system_status),
        statusTh(r.water_pump_status),
        statusTh(r.aerator_status),
        statusTh(r.mixer_wastewater_status),
        statusTh(r.mixer_chemical_status),
        r.sludge_pump_used ? statusTh(r.sludge_pump_status) : "ไม่มี",
        r.other_equipment_status || "-",
        r.excess_sludge_volume ?? "-",
        r.problems_and_solutions || "-",
        r.recorder_name || "-",
        r.notes || "-",
      ]);
    const title = "บันทึกสถิติและข้อมูลผลการทำงานของระบบบำบัดน้ำเสีย";
    const ws = XLSX.utils.aoa_to_sheet([[title], [], headers, ...dataRows]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "สถิติบำบัดน้ำเสีย");
    XLSX.writeFile(wb, `wastewater-statistics_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  return (
    <>
    <Card className="bg-white rounded-2xl shadow-elevated border-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-orange-600" /> ประวัติสถิติบำบัดน้ำเสีย
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 h-10 rounded-2xl bg-slate-50 text-slate-900" />
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="w-4 h-4" /> ทั้งหมด
            </label>
            <Button size="sm" variant="outline" className="rounded-2xl h-10 gap-1.5 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100" onClick={handleExport}>
              <Download className="h-4 w-4" /> Export Excel
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <Badge variant="secondary" className="justify-center py-2 rounded-xl">ไฟฟ้ารวม {totals.electricity.toFixed(1)}</Badge>
          <Badge variant="secondary" className="justify-center py-2 rounded-xl">น้ำใช้รวม {totals.water.toFixed(1)} ลบ.ม.</Badge>
          <Badge variant="secondary" className="justify-center py-2 rounded-xl">น้ำเสีย {totals.wastewater.toFixed(1)} ลบ.ม.</Badge>
          <Badge variant="secondary" className="justify-center py-2 rounded-xl">สารเคมี {totals.chem.toFixed(2)}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[1000px]">
            <thead>
              <tr className="bg-orange-50 border-b-2 border-orange-200 text-orange-800">
                <th className="px-2 py-2 text-left font-bold">วันที่</th>
                <th className="px-2 py-2 text-center font-bold">ไฟฟ้า</th>
                <th className="px-2 py-2 text-center font-bold">น้ำใช้</th>
                <th className="px-2 py-2 text-center font-bold">น้ำเสีย</th>
                <th className="px-2 py-2 text-center font-bold">ระบาย</th>
                <th className="px-2 py-2 text-center font-bold">สารเคมี</th>
                <th className="px-2 py-2 text-center font-bold">บำบัด</th>
                <th className="px-2 py-2 text-center font-bold">สูบน้ำ</th>
                <th className="px-2 py-2 text-center font-bold">เติมอากาศ</th>
                <th className="px-2 py-2 text-center font-bold">สูบตะกอน</th>
                <th className="px-2 py-2 text-left font-bold">ผู้บันทึก</th>
                {isAdmin && <th className="px-2 py-2 text-center font-bold">จัดการ</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any, i: number) => {
                const ok = (v: string) => v === "normal";
                const Cell = ({ v }: { v: string }) => (
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${ok(v) ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{ok(v) ? "✓" : "✕"}</span>
                );
                return (
                  <tr key={r.id} className={i % 2 ? "bg-slate-50/60" : "bg-white"}>
                    <td className="px-2 py-2">{r.record_date ? new Date(r.record_date).toLocaleDateString("th-TH") : "-"}</td>
                    <td className="px-2 py-2 text-center">{r.electricity_usage ?? "-"}</td>
                    <td className="px-2 py-2 text-center">{r.water_usage ?? "-"}</td>
                    <td className="px-2 py-2 text-center">{r.wastewater_volume ?? "-"}</td>
                    <td className="px-2 py-2 text-center">{r.discharge_method || "-"}</td>
                    <td className="px-2 py-2 text-center">{r.chemical_substances ? `${r.chemical_substances} (${r.chemical_amount ?? "-"})` : "-"}</td>
                    <td className="px-2 py-2 text-center"><Cell v={r.treatment_system_status} /></td>
                    <td className="px-2 py-2 text-center"><Cell v={r.water_pump_status} /></td>
                    <td className="px-2 py-2 text-center"><Cell v={r.aerator_status} /></td>
                    <td className="px-2 py-2 text-center">{r.sludge_pump_used ? <Cell v={r.sludge_pump_status} /> : <span className="text-slate-400 text-[10px]">ไม่มี</span>}</td>
                    <td className="px-2 py-2">{r.recorder_name || "-"}</td>
                    {isAdmin && (
                      <td className="px-2 py-2 text-center">
                        <div className="flex gap-1 justify-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-blue-600 hover:bg-blue-100" onClick={() => {
                            setEditRow(r);
                            setEditForm({
                              record_date: r.record_date || "",
                              electricity_usage: r.electricity_usage ?? "",
                              water_usage: r.water_usage ?? "",
                              wastewater_volume: r.wastewater_volume ?? "",
                              chemical_substances: r.chemical_substances || "",
                              chemical_amount: r.chemical_amount ?? "",
                              recorder_name: r.recorder_name || "",
                              notes: r.notes || "",
                              problems_and_solutions: r.problems_and_solutions || "",
                            });
                          }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("ยืนยันลบ?")) del.mutate(r.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={isAdmin ? 12 : 11} className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูล</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>

    <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>แก้ไขข้อมูลสถิติบำบัดน้ำเสีย</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">วันที่</Label><Input type="date" value={editForm.record_date} onChange={(e) => setEditForm({ ...editForm, record_date: e.target.value })} className="h-10 rounded-xl" /></div>
            <div><Label className="text-xs">ไฟฟ้า</Label><Input type="number" step="0.01" value={editForm.electricity_usage} onChange={(e) => setEditForm({ ...editForm, electricity_usage: e.target.value })} className="h-10 rounded-xl" /></div>
            <div><Label className="text-xs">น้ำใช้</Label><Input type="number" step="0.01" value={editForm.water_usage} onChange={(e) => setEditForm({ ...editForm, water_usage: e.target.value })} className="h-10 rounded-xl" /></div>
            <div><Label className="text-xs">น้ำเสีย</Label><Input type="number" step="0.01" value={editForm.wastewater_volume} onChange={(e) => setEditForm({ ...editForm, wastewater_volume: e.target.value })} className="h-10 rounded-xl" /></div>
            <div><Label className="text-xs">สารเคมี</Label><Input value={editForm.chemical_substances} onChange={(e) => setEditForm({ ...editForm, chemical_substances: e.target.value })} className="h-10 rounded-xl" /></div>
            <div><Label className="text-xs">ปริมาณสารเคมี</Label><Input type="number" step="0.01" value={editForm.chemical_amount} onChange={(e) => setEditForm({ ...editForm, chemical_amount: e.target.value })} className="h-10 rounded-xl" /></div>
          </div>
          <div><Label className="text-xs">ผู้บันทึก</Label><Input value={editForm.recorder_name} onChange={(e) => setEditForm({ ...editForm, recorder_name: e.target.value })} className="h-10 rounded-xl" /></div>
          <div><Label className="text-xs">ปัญหา/แก้ไข</Label><Input value={editForm.problems_and_solutions} onChange={(e) => setEditForm({ ...editForm, problems_and_solutions: e.target.value })} className="h-10 rounded-xl" /></div>
          <div><Label className="text-xs">หมายเหตุ</Label><Textarea rows={2} value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} className="rounded-xl" /></div>
          <Button className="w-full h-11 rounded-2xl bg-orange-600 hover:bg-orange-700" disabled={upd.isPending} onClick={() => upd.mutate()}>{upd.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}</Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}