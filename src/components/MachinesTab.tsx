import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Plus, Trash2, Download, Waves, Wind, Zap } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";

const PUMP_TYPES = ["เครื่องสูบน้ำเสีย", "เครื่องเติมอากาศ", "เครื่องควบคุม/เติมอากาศ"];

function downloadQr(elementId: string, filename: string) {
  const canvas = document.getElementById(elementId) as HTMLCanvasElement | null;
  if (!canvas) {
    toast.error("ยังสร้าง QR ไม่สำเร็จ กรุณาลองใหม่");
    return;
  }
  const link = document.createElement("a");
  link.href = canvas.toDataURL("image/png");
  link.download = `${filename}.png`;
  link.click();
  toast.success(`ดาวน์โหลด QR ${filename} แล้ว`);
}

/* ---------------- Pump / Aerator machines ---------------- */
function PumpMachinesSection() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [type, setType] = useState(PUMP_TYPES[0]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: machines = [] } = useQuery({
    queryKey: ["pump-machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pump_machines").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const addMachine = useMutation({
    mutationFn: async () => {
      const maxOrder = machines.reduce((m: number, x: any) => Math.max(m, x.sort_order || 0), 0);
      const { data, error } = await supabase
        .from("pump_machines")
        .insert({ name: name.trim(), machine_type: type, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      toast.success("เพิ่มเครื่องสำเร็จ");
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["pump-machines"] });
      setTimeout(() => downloadQr(`qr-pump-${data.id}`, `QR-${data.name}`), 600);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMachine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pump_machines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบเครื่องสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["pump-machines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const qrValue = (m: any) => m.qr_code_data || `${window.location.origin}/pump-meters?machine=${m.id}`;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Waves className="h-4 w-4 text-teal-600" /> เพิ่มเครื่องสูบน้ำเสีย / เครื่องเติมอากาศ
          </p>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเครื่อง เช่น เครื่องสูบน้ำเสีย ตัวที่ 1" className="h-11 rounded-2xl" />
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-11 rounded-2xl flex-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-white z-50">
                {PUMP_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="h-11 rounded-2xl gap-1.5 sm:w-36" onClick={() => addMachine.mutate()} disabled={!name.trim() || addMachine.isPending}>
              <Plus className="h-4 w-4" /> เพิ่มเครื่อง
            </Button>
          </div>
          <p className="text-[11px] text-slate-500">* ระบบจะสร้างและดาวน์โหลด QR Code ประจำเครื่องให้อัตโนมัติหลังเพิ่มเครื่อง</p>
        </CardContent>
      </Card>

      {machines.map((m: any) => (
        <Card key={m.id} className="rounded-2xl border-0 shadow-card">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl border">
              <QRCodeCanvas id={`qr-pump-${m.id}`} value={qrValue(m)} size={64} includeMargin />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{m.name}</p>
              <Badge variant="secondary" className="mt-1 text-[10px] rounded-lg gap-1">
                {String(m.machine_type).includes("เติมอากาศ") ? <Wind className="h-3 w-3" /> : <Waves className="h-3 w-3" />}
                {m.machine_type}
              </Badge>
            </div>
            <div className="flex flex-col sm:flex-row gap-1.5">
              <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => downloadQr(`qr-pump-${m.id}`, `QR-${m.name}`)}>
                <Download className="h-3.5 w-3.5" /> QR
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => setDeleteId(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ยืนยันการลบเครื่อง"
        description="ข้อมูลประวัติมิเตอร์ของเครื่องนี้อาจได้รับผลกระทบ"
        onConfirm={() => { if (deleteId) removeMachine.mutate(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}

/* ---------------- Generator machines ---------------- */
function GeneratorMachinesSection() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: machines = [] } = useQuery({
    queryKey: ["generator-machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("generator_machines").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const addMachine = useMutation({
    mutationFn: async () => {
      const maxOrder = machines.reduce((m: number, x: any) => Math.max(m, x.sort_order || 0), 0);
      const { data, error } = await supabase
        .from("generator_machines")
        .insert({ code: code.trim(), name: name.trim(), location: location.trim() || null, sort_order: maxOrder + 1 })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      toast.success("เพิ่มเครื่องปั่นไฟสำเร็จ");
      setCode(""); setName(""); setLocation("");
      await queryClient.invalidateQueries({ queryKey: ["generator-machines"] });
      setTimeout(() => downloadQr(`qr-gen-${data.id}`, `QR-${data.code}`), 600);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMachine = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("generator_machines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบเครื่องปั่นไฟสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["generator-machines"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const qrValue = (m: any) => m.qr_code_data || `${window.location.origin}/generator-check?code=${encodeURIComponent(m.code)}`;

  return (
    <div className="space-y-3">
      <Card className="rounded-2xl border-0 shadow-card">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> เพิ่มเครื่องปั่นไฟ (Generator)
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="รหัสเครื่อง เช่น GEN002" className="h-11 rounded-2xl" />
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อเครื่อง" className="h-11 rounded-2xl" />
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="ตำแหน่งที่ตั้ง" className="h-11 rounded-2xl" />
          </div>
          <Button className="w-full h-11 rounded-2xl gap-1.5" onClick={() => addMachine.mutate()} disabled={!code.trim() || !name.trim() || addMachine.isPending}>
            <Plus className="h-4 w-4" /> เพิ่มเครื่องปั่นไฟ
          </Button>
          <p className="text-[11px] text-slate-500">* ระบบจะสร้างและดาวน์โหลด QR Code ประจำเครื่องให้อัตโนมัติหลังเพิ่มเครื่อง</p>
        </CardContent>
      </Card>

      {machines.map((m: any) => (
        <Card key={m.id} className="rounded-2xl border-0 shadow-card">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-xl border">
              <QRCodeCanvas id={`qr-gen-${m.id}`} value={qrValue(m)} size={64} includeMargin />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800 truncate">{m.code} · {m.name}</p>
              <p className="text-[11px] text-slate-500 truncate">{m.location || "ไม่ระบุตำแหน่ง"}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-1.5">
              <Button variant="outline" size="sm" className="rounded-xl gap-1" onClick={() => downloadQr(`qr-gen-${m.id}`, `QR-${m.code}`)}>
                <Download className="h-3.5 w-3.5" /> QR
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl text-destructive" onClick={() => setDeleteId(m.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ยืนยันการลบเครื่องปั่นไฟ"
        description="รายการนี้จะหายไปจากตัวเลือกในแบบบันทึกการตรวจเช็ค"
        onConfirm={() => { if (deleteId) removeMachine.mutate(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}

export default function MachinesTab() {
  return (
    <div className="space-y-6">
      <GeneratorMachinesSection />
      <div className="h-px bg-border" />
      <PumpMachinesSection />
    </div>
  );
}
