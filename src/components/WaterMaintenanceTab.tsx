import { useState } from "react";
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
import { format, differenceInDays } from "date-fns";
import { th } from "date-fns/locale";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, Wrench, AlertTriangle, CheckCircle } from "lucide-react";

export default function WaterMaintenanceTab() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showAssetForm, setShowAssetForm] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [showTestForm, setShowTestForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ table: string; id: string } | null>(null);

  const { data: assets = [] } = useQuery({
    queryKey: ["water-assets"],
    queryFn: async () => { const { data } = await supabase.from("water_assets").select("*").order("name"); return data || []; },
  });

  const { data: schedules = [] } = useQuery({
    queryKey: ["water-schedules"],
    queryFn: async () => { const { data } = await supabase.from("water_maintenance_schedule").select("*, water_assets(name)").order("next_due"); return data || []; },
  });

  const { data: tests = [] } = useQuery({
    queryKey: ["water-emergency-tests"],
    queryFn: async () => { const { data } = await supabase.from("water_emergency_tests").select("*").order("created_at", { ascending: false }).limit(50); return data || []; },
  });

  const addAsset = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await supabase.from("water_assets").insert({
        name: fd.get("name") as string, serial_no: (fd.get("serial_no") as string) || null,
        install_date: (fd.get("install_date") as string) || null,
        lifespan_years: fd.get("lifespan_years") ? Number(fd.get("lifespan_years")) : null,
        status: fd.get("status") as string || "active", notes: (fd.get("notes") as string) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("เพิ่มอุปกรณ์สำเร็จ"); queryClient.invalidateQueries({ queryKey: ["water-assets"] }); setShowAssetForm(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const addSchedule = useMutation({
    mutationFn: async (fd: FormData) => {
      const { error } = await supabase.from("water_maintenance_schedule").insert({
        asset_id: (fd.get("asset_id") as string) || null, task_name: fd.get("task_name") as string,
        frequency: fd.get("frequency") as string, next_due: fd.get("next_due") as string,
        assigned_to: (fd.get("assigned_to") as string) || null, notes: (fd.get("notes") as string) || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("เพิ่มแผน PM สำเร็จ"); queryClient.invalidateQueries({ queryKey: ["water-schedules"] }); setShowScheduleForm(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const addTest = useMutation({
    mutationFn: async (fd: FormData) => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const pumpStatus = fd.get("pump_status") as string;
      const { error } = await supabase.from("water_emergency_tests").insert({
        pump_status: pumpStatus, pressure_bar: fd.get("pressure_bar") ? Number(fd.get("pressure_bar")) : null,
        fuel_level: (fd.get("fuel_level") as string) || null, tester_id: user.id,
        tester_name: profile?.full_name || "", notes: (fd.get("notes") as string) || null,
        status: pumpStatus === "normal" ? "pass" : "fail",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("บันทึกการทดสอบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["water-emergency-tests"] }); setShowTestForm(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-assets"] });
      queryClient.invalidateQueries({ queryKey: ["water-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["water-emergency-tests"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getDueStatus = (nextDue: string) => {
    const days = differenceInDays(new Date(nextDue), new Date());
    if (days < 0) return { label: "เลยกำหนด", color: "bg-red-100 border-red-300 text-red-800", badge: "destructive" as const };
    if (days <= 7) return { label: `อีก ${days} วัน`, color: "bg-amber-50 border-amber-300 text-amber-800", badge: "default" as const };
    return { label: format(new Date(nextDue), "d MMM yy", { locale: th }), color: "bg-slate-50 border-slate-200", badge: "secondary" as const };
  };

  return (
    <div className="space-y-4">
      {/* Assets Section */}
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><Wrench className="h-5 w-5 text-blue-500" /> ทะเบียนอุปกรณ์</h3>
            {isAdmin && <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => setShowAssetForm(true)}><Plus className="h-4 w-4" /> เพิ่ม</Button>}
          </div>
          <div className="space-y-2">
            {assets.map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.serial_no || "ไม่ระบุ S/N"} · {a.install_date ? format(new Date(a.install_date), "d MMM yy", { locale: th }) : "-"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={a.status === "active" ? "default" : "destructive"} className="text-[10px] rounded-full">
                    {a.status === "active" ? "ปกติ" : a.status === "broken" ? "ชำรุด" : "รอซ่อม"}
                  </Badge>
                  {isAdmin && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget({ table: "water_assets", id: a.id })}>✕</Button>}
                </div>
              </div>
            ))}
            {assets.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีอุปกรณ์</p>}
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Schedule */}
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> ตารางบำรุงรักษา (PM)</h3>
            {isAdmin && <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => setShowScheduleForm(true)}><Plus className="h-4 w-4" /> เพิ่ม</Button>}
          </div>
          <div className="space-y-2">
            {schedules.map((s: any) => {
              const due = getDueStatus(s.next_due);
              return (
                <div key={s.id} className={`p-3 rounded-xl border ${due.color}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{s.task_name}</p>
                      <p className="text-xs text-muted-foreground">{s.water_assets?.name || "-"} · {s.frequency}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={due.badge} className="text-[10px] rounded-full">{due.label}</Badge>
                      {isAdmin && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget({ table: "water_maintenance_schedule", id: s.id })}>✕</Button>}
                    </div>
                  </div>
                </div>
              );
            })}
            {schedules.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีแผน PM</p>}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Tests */}
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-800 flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-500" /> ทดสอบปั๊มสำรอง/ฉุกเฉิน</h3>
            <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => setShowTestForm(true)}><Plus className="h-4 w-4" /> บันทึก</Button>
          </div>
          <div className="space-y-2">
            {tests.slice(0, 10).map((t: any) => (
              <div key={t.id} className={`p-3 rounded-xl border ${t.pump_status !== "normal" ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold">ปั๊ม: {t.pump_status === "normal" ? "ปกติ" : "ผิดปกติ"} {t.pressure_bar ? `· ${t.pressure_bar} Bar` : ""}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(t.created_at), "d MMM yy HH:mm", { locale: th })} · {t.tester_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={t.status === "pass" ? "default" : "destructive"} className="text-[10px] rounded-full">
                      {t.status === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                    </Badge>
                    {isAdmin && <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget({ table: "water_emergency_tests", id: t.id })}>✕</Button>}
                  </div>
                </div>
              </div>
            ))}
            {tests.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">ยังไม่มีข้อมูล</p>}
          </div>
        </CardContent>
      </Card>

      {/* Add Asset Dialog */}
      <Dialog open={showAssetForm} onOpenChange={setShowAssetForm}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle>เพิ่มอุปกรณ์ระบบน้ำ</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addAsset.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label>ชื่ออุปกรณ์ *</Label><Input name="name" required className="h-11 rounded-2xl" /></div>
            <div><Label>หมายเลขเครื่อง</Label><Input name="serial_no" className="h-11 rounded-2xl" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>วันติดตั้ง</Label><Input name="install_date" type="date" className="h-11 rounded-2xl" /></div>
              <div><Label>อายุใช้งาน (ปี)</Label><Input name="lifespan_years" type="number" className="h-11 rounded-2xl" /></div>
            </div>
            <div><Label>สถานะ</Label>
              <select name="status" className="w-full rounded-2xl border border-input px-3 py-3 text-sm">
                <option value="active">ปกติ</option><option value="broken">ชำรุด</option><option value="waiting">รอซ่อม</option>
              </select>
            </div>
            <div><Label>หมายเหตุ</Label><Input name="notes" className="h-11 rounded-2xl" /></div>
            <Button type="submit" className="w-full h-12 rounded-2xl" disabled={addAsset.isPending}>บันทึก</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Schedule Dialog */}
      <Dialog open={showScheduleForm} onOpenChange={setShowScheduleForm}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle>เพิ่มแผนบำรุงรักษา</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addSchedule.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label>ชื่องาน *</Label><Input name="task_name" required className="h-11 rounded-2xl" placeholder="เช่น ล้างถังพักน้ำ" /></div>
            <div><Label>อุปกรณ์</Label>
              <select name="asset_id" className="w-full rounded-2xl border border-input px-3 py-3 text-sm">
                <option value="">- ไม่ระบุ -</option>
                {assets.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ความถี่</Label>
                <select name="frequency" className="w-full rounded-2xl border border-input px-3 py-3 text-sm">
                  <option value="weekly">รายสัปดาห์</option><option value="monthly">รายเดือน</option>
                  <option value="quarterly">ทุก 3 เดือน</option><option value="biannual">ทุก 6 เดือน</option><option value="yearly">รายปี</option>
                </select>
              </div>
              <div><Label>กำหนดครั้งถัดไป *</Label><Input name="next_due" type="date" required className="h-11 rounded-2xl" /></div>
            </div>
            <div><Label>ผู้รับผิดชอบ</Label><Input name="assigned_to" className="h-11 rounded-2xl" /></div>
            <div><Label>หมายเหตุ</Label><Input name="notes" className="h-11 rounded-2xl" /></div>
            <Button type="submit" className="w-full h-12 rounded-2xl" disabled={addSchedule.isPending}>บันทึก</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Emergency Test Dialog */}
      <Dialog open={showTestForm} onOpenChange={setShowTestForm}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle>บันทึกทดสอบปั๊มสำรอง</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addTest.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label>สถานะปั๊ม *</Label>
              <select name="pump_status" className="w-full rounded-2xl border border-input px-3 py-3 text-sm">
                <option value="normal">ปกติ</option><option value="abnormal">ผิดปกติ</option>
              </select>
            </div>
            <div><Label>แรงดันน้ำ (Bar)</Label><Input name="pressure_bar" type="number" step="0.1" className="h-11 rounded-2xl" /></div>
            <div><Label>ระดับน้ำมันเชื้อเพลิง</Label><Input name="fuel_level" className="h-11 rounded-2xl" placeholder="เช่น เต็ม, 3/4, ครึ่ง" /></div>
            <div><Label>หมายเหตุ</Label><Textarea name="notes" rows={2} className="rounded-2xl" /></div>
            <Button type="submit" className="w-full h-12 rounded-2xl" disabled={addTest.isPending}>บันทึก</Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="ยืนยันลบข้อมูล"
        description="ต้องการลบรายการนี้หรือไม่?"
        onConfirm={() => { if (deleteTarget) { deleteItem.mutate(deleteTarget); setDeleteTarget(null); } }}
      />
    </div>
  );
}
