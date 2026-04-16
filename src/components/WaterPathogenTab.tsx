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
import { exportToExcel } from "@/lib/exportExcel";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Plus, Download, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

const SAMPLE_POINTS = [
  "ถังพักน้ำอาคาร A", "ถังพักน้ำอาคาร B", "ก๊อกน้ำตึก OPD", "ก๊อกน้ำตึก IPD",
  "ห้องฟอกไต", "ห้องผ่าตัด", "โรงครัว", "ถังเก็บน้ำดาดฟ้า", "จุดจ่ายน้ำประปา"
];

export default function WaterPathogenTab() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    sample_point: "", chlorine_value: "", total_coliform: "not_found", e_coli: "not_found", notes: "",
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["water-pathogen-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("water_pathogen_logs").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const thisMonth = useMemo(() => {
    const now = new Date();
    return logs.filter((l: any) => {
      const d = new Date(l.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
  }, [logs]);

  const stats = useMemo(() => {
    const total = thisMonth.length;
    const passed = thisMonth.filter((l: any) => l.status === "pass").length;
    const found = thisMonth.filter((l: any) => l.total_coliform === "found" || l.e_coli === "found").length;
    return { total, passed, found };
  }, [thisMonth]);

  const addLog = useMutation({
    mutationFn: async () => {
      if (!user || !form.sample_point) throw new Error("กรุณากรอกข้อมูล");
      const cl = form.chlorine_value ? Number(form.chlorine_value) : null;
      const hasPathogen = form.total_coliform === "found" || form.e_coli === "found";
      const clOk = !cl || (cl >= 0.2 && cl <= 0.5);
      const status = hasPathogen || !clOk ? "fail" : "pass";
      const { error } = await supabase.from("water_pathogen_logs").insert({
        sample_point: form.sample_point, chlorine_value: cl,
        total_coliform: form.total_coliform, e_coli: form.e_coli,
        inspector_id: user.id, inspector_name: profile?.full_name || "",
        notes: form.notes || null, status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-pathogen-logs"] });
      setShowForm(false);
      setForm({ sample_point: "", chlorine_value: "", total_coliform: "not_found", e_coli: "not_found", notes: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("water_pathogen_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-pathogen-logs"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const chlorineVal = form.chlorine_value ? Number(form.chlorine_value) : null;
  const isChlorineWarning = chlorineVal !== null && (chlorineVal < 0.2 || chlorineVal > 0.5);

  return (
    <div className="space-y-4">
      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-blue-500">
          <CardContent className="p-3 md:p-4 text-center">
            <p className="text-xl md:text-2xl font-extrabold text-blue-600">{stats.total}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">จุดตรวจเดือนนี้</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-emerald-500">
          <CardContent className="p-3 md:p-4 text-center">
            <CheckCircle className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-xl md:text-2xl font-extrabold text-emerald-600">{stats.passed}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">ผ่านมาตรฐาน</p>
          </CardContent>
        </Card>
        <Card className="bg-white rounded-2xl shadow-elevated border-0 border-t-4 border-t-red-500">
          <CardContent className="p-3 md:p-4 text-center">
            <XCircle className="h-4 w-4 text-red-500 mx-auto mb-1" />
            <p className="text-xl md:text-2xl font-extrabold text-red-600">{stats.found}</p>
            <p className="text-[10px] md:text-xs text-muted-foreground">พบเชื้อ</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button className="flex-1 h-12 rounded-2xl text-base font-bold gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-5 w-5" /> เพิ่มบันทึกใหม่
        </Button>
        <Button variant="outline" size="sm" className="rounded-2xl h-12 gap-1.5" onClick={() => {
          exportToExcel(logs.map((l: any) => ({
            "วันที่": format(new Date(l.created_at), "d MMM yyyy HH:mm", { locale: th }),
            "จุดเก็บตัวอย่าง": l.sample_point, "คลอรีน (mg/l)": l.chlorine_value ?? "-",
            "Total Coliform": l.total_coliform === "found" ? "พบ" : "ไม่พบ",
            "E. coli": l.e_coli === "found" ? "พบ" : "ไม่พบ",
            "สถานะ": l.status === "pass" ? "ผ่าน" : "ไม่ผ่าน",
            "ผู้ตรวจ": l.inspector_name, "หมายเหตุ": l.notes || "-",
          })), "pathogen-logs", "ตรวจเชื้อ");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>
          <Download className="h-4 w-4" /> Excel
        </Button>
      </div>

      {/* Records - Cards on mobile, table on desktop */}
      <div className="hidden md:block">
        <Card className="bg-white rounded-2xl shadow-elevated border-0">
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-blue-200 bg-blue-50/50">
                    <th className="text-left py-2 px-2 text-xs font-bold text-blue-700">วันที่</th>
                    <th className="text-left py-2 px-2 text-xs font-bold text-blue-700">จุดเก็บตัวอย่าง</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">คลอรีน</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">Coliform</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">E.coli</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">สถานะ</th>
                    <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">ผู้ตรวจ</th>
                    {isAdmin && <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">จัดการ</th>}
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 50).map((log: any, i: number) => {
                    const clVal = log.chlorine_value != null ? Number(log.chlorine_value) : null;
                    const clWarning = clVal !== null && (clVal < 0.2 || clVal > 0.5);
                    return (
                      <tr key={log.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="py-2 px-2 text-xs">{format(new Date(log.created_at), "d MMM yy HH:mm", { locale: th })}</td>
                        <td className="py-2 px-2 text-xs font-medium">{log.sample_point}</td>
                        <td className={`py-2 px-2 text-center text-xs ${clWarning ? "text-red-600 font-bold" : ""}`}>
                          {clVal ?? "-"}
                          {clWarning && <span className="block text-[9px]">⚠️ไม่ได้มาตรฐาน</span>}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={log.total_coliform === "found" ? "destructive" : "default"} className="text-[10px] rounded-full">
                            {log.total_coliform === "found" ? "พบ" : "ไม่พบ"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={log.e_coli === "found" ? "destructive" : "default"} className="text-[10px] rounded-full">
                            {log.e_coli === "found" ? "พบ" : "ไม่พบ"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Badge variant={log.status === "pass" ? "default" : "destructive"} className="text-[10px] rounded-full">
                            {log.status === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center text-xs">{log.inspector_name}</td>
                        {isAdmin && (
                          <td className="py-2 px-2 text-center">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteId(log.id)}>✕</Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  {logs.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">ยังไม่มีข้อมูล</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-2">
        {logs.slice(0, 30).map((log: any) => {
          const clVal = log.chlorine_value != null ? Number(log.chlorine_value) : null;
          const clWarning = clVal !== null && (clVal < 0.2 || clVal > 0.5);
          const hasPathogen = log.total_coliform === "found" || log.e_coli === "found";
          return (
            <Card key={log.id} className={`rounded-2xl shadow-card border-0 ${hasPathogen ? "border-l-4 border-l-red-500" : ""}`}>
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold">{log.sample_point}</span>
                  <Badge variant={log.status === "pass" ? "default" : "destructive"} className="text-[10px] rounded-full">
                    {log.status === "pass" ? "ผ่าน" : "ไม่ผ่าน"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{format(new Date(log.created_at), "d MMM yy HH:mm", { locale: th })} · {log.inspector_name}</p>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-xs ${clWarning ? "text-red-600 font-bold" : ""}`}>คลอรีน: {clVal ?? "-"} mg/l</span>
                  <Badge variant={log.total_coliform === "found" ? "destructive" : "secondary"} className="text-[9px]">Coliform: {log.total_coliform === "found" ? "พบ" : "ไม่พบ"}</Badge>
                  <Badge variant={log.e_coli === "found" ? "destructive" : "secondary"} className="text-[9px]">E.coli: {log.e_coli === "found" ? "พบ" : "ไม่พบ"}</Badge>
                </div>
                {isAdmin && (
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => setDeleteId(log.id)}>ลบ</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {logs.length === 0 && <p className="text-center text-muted-foreground py-8">ยังไม่มีข้อมูล</p>}
      </div>

      {/* Add Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="rounded-3xl max-w-md">
          <DialogHeader><DialogTitle className="text-lg">บันทึกตรวจเชื้อจุดเสี่ยง</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="rounded-2xl bg-blue-50 p-3 space-y-1 text-sm">
              <p><span className="font-semibold">วันที่:</span> {new Date().toLocaleDateString("th-TH")}</p>
              <p><span className="font-semibold">ผู้ตรวจ:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
            </div>
            <div>
              <Label className="font-semibold">จุดเก็บตัวอย่าง *</Label>
              <Select value={form.sample_point} onValueChange={(v) => setForm({ ...form, sample_point: v })}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกจุด" /></SelectTrigger>
                <SelectContent>
                  {SAMPLE_POINTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="font-semibold">ค่าคลอรีนอิสระคงเหลือ (mg/l)</Label>
              <Input type="number" step="0.01" value={form.chlorine_value} onChange={(e) => setForm({ ...form, chlorine_value: e.target.value })} placeholder="0.30" className="h-12 rounded-2xl" />
              {isChlorineWarning && (
                <p className="text-red-600 text-xs font-bold mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> ค่าคลอรีนไม่ได้มาตรฐาน (เกณฑ์ 0.2-0.5 mg/l)
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-semibold">Total Coliform</Label>
                <Select value={form.total_coliform} onValueChange={(v) => setForm({ ...form, total_coliform: v })}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_found">ไม่พบ</SelectItem>
                    <SelectItem value="found">พบ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm font-semibold">E. coli</Label>
                <Select value={form.e_coli} onValueChange={(v) => setForm({ ...form, e_coli: v })}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_found">ไม่พบ</SelectItem>
                    <SelectItem value="found">พบ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {(form.total_coliform === "found" || form.e_coli === "found") && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-2xl">
                <p className="text-red-700 text-sm font-bold flex items-center gap-1"><AlertTriangle className="h-4 w-4" /> High Risk - พบเชื้อ!</p>
                <p className="text-red-600 text-xs mt-1">แนะนำแจ้งทีมซ่อมบำรุงทันที</p>
              </div>
            )}
            <div>
              <Label className="font-semibold">หมายเหตุ</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="rounded-2xl" />
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addLog.mutate()} disabled={addLog.isPending || !form.sample_point}>
              {addLog.isPending ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="ยืนยันลบข้อมูล"
        description="ต้องการลบบันทึกนี้หรือไม่?"
        onConfirm={() => { if (deleteId) { deleteLog.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
