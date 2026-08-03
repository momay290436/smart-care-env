import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Resident = { name: string; units: number };

const emptyForm = { id: "", meter_name: "", location_code: "", serial_number: "", qr_url: "", residents: [] as Resident[] };

export default function ElectricityMetersTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { data: meters = [] } = useQuery({
    queryKey: ["admin-electricity-meters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("electricity_meters")
        .select("id, meter_name, location_code, serial_number, qr_url, residents")
        .order("meter_name");
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!form.meter_name.trim()) throw new Error("กรุณาระบุชื่อสถานที่");
      const residents = form.residents
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), units: Number(r.units) || 0 }));
      const payload: any = {
        meter_name: form.meter_name.trim(),
        location_code: form.location_code.trim() || form.meter_name.trim(),
        serial_number: form.serial_number.trim() || null,
        qr_url: form.qr_url.trim() || null,
        residents,
      };
      if (form.id) {
        const { error } = await supabase.from("electricity_meters").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("electricity_meters").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกสถานที่ติดตั้งสำเร็จ");
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["admin-electricity-meters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("electricity_meters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสถานที่สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["admin-electricity-meters"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openEdit = (m: any) => {
    setForm({
      id: m.id,
      meter_name: m.meter_name || "",
      location_code: m.location_code || "",
      serial_number: m.serial_number || "",
      qr_url: m.qr_url || "",
      residents: Array.isArray(m.residents) ? m.residents : [],
    });
    setOpen(true);
  };

  const filtered = meters.filter((m: any) =>
    !search.trim() || (m.meter_name || "").toLowerCase().includes(search.trim().toLowerCase())
  );

  const residentLabel = (m: any) => {
    const rs: Resident[] = Array.isArray(m.residents) ? m.residents : [];
    if (rs.length === 0) return "-";
    return rs.map((r) => `${r.name}(${r.units || 0})`).join(", ");
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        จัดการสถานที่ติดตั้งมิเตอร์ไฟฟ้า พร้อมชื่อ-สกุลเจ้าหน้าที่ที่พักในแต่ละห้อง และจำนวนยูนิตที่ได้รับการลดหย่อน
      </p>
      <div className="flex gap-2">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหาสถานที่" className="flex-1 h-12 rounded-2xl" />
        <Button className="h-12 rounded-2xl gap-1.5 px-5" onClick={() => { setForm({ ...emptyForm }); setOpen(true); }}>
          <Plus className="h-4 w-4" /> เพิ่ม
        </Button>
      </div>

      {filtered.map((m: any) => (
        <Card key={m.id} className="shadow-card border-0 rounded-2xl">
          <CardContent className="p-4 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-base truncate">{m.meter_name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                รหัส: {m.location_code || "-"}{m.serial_number ? ` · เลขเครื่อง: ${m.serial_number}` : ""}
              </p>
              <p className="text-sm mt-1.5 break-words">ผู้พัก: {residentLabel(m)}</p>
              <Badge variant="secondary" className="rounded-2xl text-xs mt-2">
                ลดหย่อนรวม {(Array.isArray(m.residents) ? m.residents : []).reduce((s: number, r: Resident) => s + (Number(r.units) || 0), 0)} หน่วย
              </Badge>
            </div>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => openEdit(m)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" className="rounded-2xl text-destructive" onClick={() => setDeleteId(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">ยังไม่มีรายการ</p>}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขสถานที่ติดตั้ง" : "เพิ่มสถานที่ติดตั้ง"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">ชื่อสถานที่ (ใส่วงเล็บประเภทท้ายชื่อ เช่น ห้อง 101(แฟลต1))</Label>
              <Input value={form.meter_name} onChange={(e) => setForm({ ...form, meter_name: e.target.value })} className="h-11 rounded-2xl mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">รหัสภายใน</Label>
                <Input value={form.location_code} onChange={(e) => setForm({ ...form, location_code: e.target.value })} className="h-11 rounded-2xl mt-1" />
              </div>
              <div>
                <Label className="text-sm font-semibold">หมายเลขเครื่องมิเตอร์</Label>
                <Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} className="h-11 rounded-2xl mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold">QR URL</Label>
              <Input value={form.qr_url} onChange={(e) => setForm({ ...form, qr_url: e.target.value })} placeholder="เช่น 12345.lovable.com" className="h-11 rounded-2xl mt-1" />
            </div>

            <div className="rounded-2xl border border-border p-3 space-y-2 bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold">เจ้าหน้าที่ที่พัก + ยูนิตลดหย่อน</Label>
                <Button size="sm" variant="outline" className="rounded-xl h-8 gap-1"
                  onClick={() => setForm({ ...form, residents: [...form.residents, { name: "", units: 0 }] })}>
                  <Plus className="h-3.5 w-3.5" /> เพิ่มคน
                </Button>
              </div>
              {form.residents.length === 0 && <p className="text-xs text-muted-foreground">ยังไม่มีข้อมูลผู้พัก</p>}
              {form.residents.map((r, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    value={r.name}
                    placeholder="ชื่อ-สกุล"
                    onChange={(e) => {
                      const next = [...form.residents];
                      next[idx] = { ...next[idx], name: e.target.value };
                      setForm({ ...form, residents: next });
                    }}
                    className="h-10 rounded-xl flex-1"
                  />
                  <Input
                    type="number"
                    value={r.units}
                    placeholder="ยูนิต"
                    onChange={(e) => {
                      const next = [...form.residents];
                      next[idx] = { ...next[idx], units: Number(e.target.value) };
                      setForm({ ...form, residents: next });
                    }}
                    className="h-10 rounded-xl w-24 text-center"
                  />
                  <Button size="sm" variant="ghost" className="rounded-xl text-destructive"
                    onClick={() => setForm({ ...form, residents: form.residents.filter((_, i) => i !== idx) })}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                รวมยูนิตลดหย่อน: {form.residents.reduce((s, r) => s + (Number(r.units) || 0), 0)} หน่วย
              </p>
            </div>

            <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบสถานที่ติดตั้ง"
        description="ยืนยันการลบสถานที่นี้? ประวัติที่เชื่อมโยงอาจได้รับผลกระทบ"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
