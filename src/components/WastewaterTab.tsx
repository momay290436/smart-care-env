import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { Plus, Download, FlaskConical, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wastewater inspection logs (ประวัติการตรวจระบบบำบัดน้ำเสีย).
 * - Insert form (called from parent via `open`).
 * - History table with client-side Excel export (0% Disk I/O).
 */
export function WastewaterInsertDialog({ open, onOpenChange }: Props) {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    check_date: format(new Date(), "yyyy-MM-dd"),
    check_time: format(new Date(), "HH:mm"),
    chlorine_residual: "",
    ph_value: "",
    water_appearance: "ใส",
    wastewater_volume: "",
    inlet_meter: "",
    outlet_meter: "",
    aerator_status: "normal",
    sludge_pump_status: "normal",
    notes: "",
    recorder_name: "",
  });

  const cl = form.chlorine_residual ? Number(form.chlorine_residual) : null;
  const chlorineWarning = cl !== null && (cl <= 0.5 || cl > 1.0);

  const insertLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("กรุณาเข้าสู่ระบบ");
      const payload: any = {
        check_date: form.check_date,
        check_time: form.check_time,
        chlorine_residual: form.chlorine_residual ? Number(form.chlorine_residual) : null,
        ph_value: form.ph_value ? Number(form.ph_value) : null,
        water_appearance: form.water_appearance || null,
        wastewater_volume: form.wastewater_volume ? Number(form.wastewater_volume) : null,
        inlet_meter: form.inlet_meter ? Number(form.inlet_meter) : null,
        outlet_meter: form.outlet_meter ? Number(form.outlet_meter) : null,
        aerator_status: form.aerator_status,
        sludge_pump_status: form.sludge_pump_status,
        notes: form.notes || null,
        recorded_by: user.id,
        recorder_name: (isAdmin && form.recorder_name.trim()) ? form.recorder_name.trim() : (profile?.full_name || ""),
      };
      const { error } = await (supabase as any).from("wastewater_inspection_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตรวจระบบบำบัดน้ำเสียสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-logs"] });
      onOpenChange(false);
      setForm({
        check_date: format(new Date(), "yyyy-MM-dd"),
        check_time: format(new Date(), "HH:mm"),
        chlorine_residual: "", ph_value: "", water_appearance: "ใส",
        wastewater_volume: "", inlet_meter: "", outlet_meter: "",
        aerator_status: "normal", sludge_pump_status: "normal",
        notes: "", recorder_name: "",
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-emerald-600" /> ตรวจระบบบำบัดน้ำเสีย
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-2xl bg-emerald-50 p-3 text-sm">
            <p><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">วันที่ตรวจ *</Label>
              <Input type="date" value={form.check_date} onChange={(e) => setForm({ ...form, check_date: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">เวลา *</Label>
              <Input type="time" value={form.check_time} onChange={(e) => setForm({ ...form, check_time: e.target.value })} className="h-11 rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">คลอรีนตกค้าง (mg/l)</Label>
              <Input type="number" step="0.01" value={form.chlorine_residual} onChange={(e) => setForm({ ...form, chlorine_residual: e.target.value })} className="h-11 rounded-2xl" />
              {chlorineWarning && (
                <p className="text-xs text-red-600 font-semibold mt-1">⚠ ค่าคลอรีนไม่ได้มาตรฐาน (เกณฑ์ 0.5 - 1.0 mg/l)</p>
              )}
            </div>
            <div>
              <Label className="text-xs font-semibold">ค่า PH</Label>
              <Input type="number" step="0.1" value={form.ph_value} onChange={(e) => setForm({ ...form, ph_value: e.target.value })} className="h-11 rounded-2xl" />
            </div>
          </div>
          <div>
            <Label className="text-xs font-semibold">ลักษณะน้ำทิ้ง</Label>
            <Select value={form.water_appearance} onValueChange={(v) => setForm({ ...form, water_appearance: v })}>
              <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ใส">ใส</SelectItem>
                <SelectItem value="ขุ่น">ขุ่น</SelectItem>
                <SelectItem value="มีตะกอน">มีตะกอน</SelectItem>
                <SelectItem value="มีกลิ่น">มีกลิ่น</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs font-semibold">ปริมาณน้ำเสีย (ลบ.ม./วัน)</Label>
              <Input type="number" step="0.1" value={form.wastewater_volume} onChange={(e) => setForm({ ...form, wastewater_volume: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">มิเตอร์น้ำเข้า</Label>
              <Input type="number" step="0.01" value={form.inlet_meter} onChange={(e) => setForm({ ...form, inlet_meter: e.target.value })} className="h-11 rounded-2xl" />
            </div>
            <div>
              <Label className="text-xs font-semibold">มิเตอร์น้ำออก</Label>
              <Input type="number" step="0.01" value={form.outlet_meter} onChange={(e) => setForm({ ...form, outlet_meter: e.target.value })} className="h-11 rounded-2xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">เครื่องเติมอากาศ</Label>
              <Select value={form.aerator_status} onValueChange={(v) => setForm({ ...form, aerator_status: v })}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">ปกติ</SelectItem>
                  <SelectItem value="abnormal">ไม่ปกติ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-semibold">เครื่องสูบตะกอน</Label>
              <Select value={form.sludge_pump_status} onValueChange={(v) => setForm({ ...form, sludge_pump_status: v })}>
                <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">ปกติ</SelectItem>
                  <SelectItem value="abnormal">ไม่ปกติ</SelectItem>
                </SelectContent>
              </Select>
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
          <Button className="w-full h-12 rounded-2xl text-base font-bold bg-emerald-600 hover:bg-emerald-700" disabled={insertLog.isPending} onClick={() => insertLog.mutate()}>
            {insertLog.isPending ? "กำลังบันทึก..." : "บันทึก"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function WastewaterTab() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [openInsert, setOpenInsert] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));
  const [showAll, setShowAll] = useState(false);

  const { data: logs = [] } = useQuery({
    queryKey: ["wastewater-logs"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("wastewater_inspection_logs")
        .select("*")
        .order("check_date", { ascending: false })
        .order("check_time", { ascending: false })
        .limit(500);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    if (showAll) return logs;
    return (logs as any[]).filter((l) => (l.check_date || "").startsWith(filterMonth));
  }, [logs, filterMonth, showAll]);

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("wastewater_inspection_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    if (filtered.length === 0) { toast.info("ไม่มีข้อมูลให้ส่งออก"); return; }
    const headers = ["ลำดับ", "วันที่", "เวลา", "คลอรีนตกค้าง (mg/l)", "ค่า PH", "ลักษณะน้ำทิ้ง", "ปริมาณน้ำเสีย (ลบ.ม./วัน)", "เลขมิเตอร์น้ำเข้า", "เลขมิเตอร์น้ำออก", "เครื่องเติมอากาศ", "เครื่องสูบตะกอน", "หมายเหตุ", "ผู้จดบันทึก"];
    const rows = [...(filtered as any[])]
      .sort((a, b) => (a.check_date || "").localeCompare(b.check_date || "") || (a.check_time || "").localeCompare(b.check_time || ""))
      .map((l: any, i: number) => [
        i + 1,
        l.check_date ? new Date(l.check_date).toLocaleDateString("th-TH") : "-",
        l.check_time || "-",
        l.chlorine_residual ?? "-",
        l.ph_value ?? "-",
        l.water_appearance || "-",
        l.wastewater_volume ?? "-",
        l.inlet_meter ?? "-",
        l.outlet_meter ?? "-",
        l.aerator_status === "normal" ? "ปกติ" : "ไม่ปกติ",
        l.sludge_pump_status === "normal" ? "ปกติ" : "ไม่ปกติ",
        l.notes || "-",
        l.recorder_name || "-",
      ]);
    const title = "รายงานการตรวจระบบบำบัดน้ำเสีย";
    const ws = XLSX.utils.aoa_to_sheet([[title], [], headers, ...rows]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
    ws["!cols"] = headers.map(() => ({ wch: 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "บำบัดน้ำเสีย");
    const today = format(new Date(), "dd-MM-yyyy");
    XLSX.writeFile(wb, `รายงานการตรวจระบบบำบัดน้ำเสีย_ประจำวันที่_${today}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-emerald-600" /> ประวัติการตรวจระบบบำบัดน้ำเสีย
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="w-40 h-10 rounded-2xl bg-slate-50 text-slate-900" />
              <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} className="w-4 h-4" /> ทั้งหมด
              </label>
              <Button size="sm" variant="outline" className="rounded-2xl h-10 gap-1.5 bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export Excel
              </Button>
              <Button size="sm" className="rounded-2xl h-10 gap-1.5 bg-emerald-600 hover:bg-emerald-700" onClick={() => setOpenInsert(true)}>
                <Plus className="h-4 w-4" /> บันทึกใหม่
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-emerald-50 border-b-2 border-emerald-200 text-emerald-800">
                  <th className="px-2 py-2 text-center text-xs font-bold">ลำดับ</th>
                  <th className="px-2 py-2 text-left text-xs font-bold">วันที่</th>
                  <th className="px-2 py-2 text-left text-xs font-bold">เวลา</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">คลอรีน</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">PH</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">ลักษณะน้ำ</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">ปริมาณ</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">มิเตอร์เข้า</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">มิเตอร์ออก</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">เครื่องเติมอากาศ</th>
                  <th className="px-2 py-2 text-center text-xs font-bold">สูบตะกอน</th>
                  <th className="px-2 py-2 text-left text-xs font-bold">ผู้บันทึก</th>
                  {isAdmin && <th className="px-2 py-2 text-center text-xs font-bold">จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l: any, i: number) => {
                  const cl = l.chlorine_residual != null ? Number(l.chlorine_residual) : null;
                  const warn = cl !== null && (cl <= 0.5 || cl > 1.0);
                  return (
                    <tr key={l.id} className={i % 2 ? "bg-slate-50/60 hover:bg-emerald-50/40" : "bg-white hover:bg-emerald-50/40"}>
                      <td className="px-2 py-2 text-center text-xs">{i + 1}</td>
                      <td className="px-2 py-2 text-xs">{l.check_date ? new Date(l.check_date).toLocaleDateString("th-TH") : "-"}</td>
                      <td className="px-2 py-2 text-xs">{l.check_time || "-"}</td>
                      <td className={`px-2 py-2 text-center text-xs ${warn ? "text-red-600 font-bold" : ""}`}>{cl ?? "-"}</td>
                      <td className="px-2 py-2 text-center text-xs">{l.ph_value ?? "-"}</td>
                      <td className="px-2 py-2 text-center text-xs">{l.water_appearance || "-"}</td>
                      <td className="px-2 py-2 text-center text-xs">{l.wastewater_volume ?? "-"}</td>
                      <td className="px-2 py-2 text-center text-xs">{l.inlet_meter ?? "-"}</td>
                      <td className="px-2 py-2 text-center text-xs">{l.outlet_meter ?? "-"}</td>
                      <td className="px-2 py-2 text-center">
                        <Badge variant={l.aerator_status === "normal" ? "default" : "destructive"} className="text-[10px] rounded-full">
                          {l.aerator_status === "normal" ? "ปกติ" : "ไม่ปกติ"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <Badge variant={l.sludge_pump_status === "normal" ? "default" : "destructive"} className="text-[10px] rounded-full">
                          {l.sludge_pump_status === "normal" ? "ปกติ" : "ไม่ปกติ"}
                        </Badge>
                      </td>
                      <td className="px-2 py-2 text-xs">{l.recorder_name || "-"}</td>
                      {isAdmin && (
                        <td className="px-2 py-2 text-center">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm("ยืนยันลบ?")) deleteLog.mutate(l.id); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={isAdmin ? 13 : 12} className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <WastewaterInsertDialog open={openInsert} onOpenChange={setOpenInsert} />
    </div>
  );
}