import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ConfirmDialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Send } from "lucide-react";

export const NOTIFICATION_TOPICS: { value: string; label: string }[] = [
  { value: "water_alert", label: "คุณภาพน้ำ / ระบบบำบัดน้ำเสีย" },
  { value: "env_round", label: "ENV Round" },
  { value: "audit_5s", label: "ตรวจ 5ส." },
  { value: "fire_safety", label: "ความปลอดภัย / อัคคีภัย" },
  { value: "maintenance", label: "แจ้งซ่อม / บำรุงรักษา" },
  { value: "hazmat", label: "สารเคมีอันตราย (HAZMAT)" },
  { value: "waste", label: "ขยะ" },
  { value: "issue", label: "จัดการปัญหา" },
];

const emptyForm = { id: "", display_name: "", line_user_id: "", topics: [] as string[], is_active: true };

export default function LineNotificationSettings() {
  const queryClient = useQueryClient();
  const [channelToken, setChannelToken] = useState("");
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [savingToken, setSavingToken] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [alertPreview, setAlertPreview] = useState("");
  const [testingAlert, setTestingAlert] = useState(false);

  useQuery({
    queryKey: ["line-channel-token"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "line_channel_token").maybeSingle();
      if (!tokenLoaded) { setChannelToken(data?.value || ""); setTokenLoaded(true); }
      return data?.value || "";
    },
  });

  const { data: recipients = [], isLoading } = useQuery({
    queryKey: ["notification-recipients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_recipients")
        .select("id, display_name, line_user_id, topics, is_active")
        .order("display_name");
      if (error) throw error;
      return data || [];
    },
  });

  const saveToken = async () => {
    setSavingToken(true);
    try {
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "line_channel_token").maybeSingle();
      if (existing) await supabase.from("app_settings").update({ value: channelToken.trim() }).eq("key", "line_channel_token");
      else await supabase.from("app_settings").insert({ key: "line_channel_token", value: channelToken.trim() });
      toast.success("บันทึก LINE Channel Access Token สำเร็จ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingToken(false);
    }
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.display_name.trim()) throw new Error("กรุณาระบุชื่อผู้รับ");
      if (!form.line_user_id.trim()) throw new Error("กรุณาระบุ LINE User ID / Group ID");
      const payload = {
        display_name: form.display_name.trim(),
        line_user_id: form.line_user_id.trim(),
        topics: form.topics,
        is_active: form.is_active,
      };
      if (form.id) {
        const { error } = await supabase.from("notification_recipients").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("notification_recipients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกผู้รับการแจ้งเตือนสำเร็จ");
      setOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ["notification-recipients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notification_recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบผู้รับสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["notification-recipients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendTest = async (r: any) => {
    setTestingId(r.id);
    try {
      const { data, error } = await supabase.functions.invoke("line-notify", {
        body: {
          message: `🔔 ทดสอบระบบแจ้งเตือน Smart ENV & 5S\nผู้รับ: ${r.display_name}\nหากได้รับข้อความนี้แสดงว่าตั้งค่าถูกต้องแล้ว`,
          recipient_ids: [r.line_user_id],
        },
      });
      if (error) throw error;
      if (data?.sent === false) throw new Error(data?.reason || "ส่งไม่สำเร็จ");
      toast.success(`ส่งข้อความทดสอบถึง ${r.display_name} สำเร็จ`);
    } catch (e: any) {
      const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e));
      toast.error("ส่งไม่สำเร็จ: " + msg);
    } finally {
      setTestingId(null);
    }
  };

  const testWaterAlert = async (dryRun: boolean) => {
    setTestingAlert(true);
    setAlertPreview("");
    try {
      const { data, error } = await supabase.functions.invoke("water-alert-daily", { body: { dryRun } });
      if (error) throw error;
      setAlertPreview(data?.message || "วันนี้ไม่พบข้อมูลผิดปกติ จึงไม่มีข้อความแจ้งเตือน");
      if (dryRun) toast.info("ดูตัวอย่างข้อความด้านล่าง (ยังไม่ส่งจริง)");
      else if (data?.sent) toast.success(`ส่งแจ้งเตือนสำเร็จ (${data.count || 0} รายการ)`);
      else toast.warning(data?.reason === "no_anomaly" ? "วันนี้ไม่พบความผิดปกติ" : `ไม่ได้ส่ง: ${data?.reason || "ตรวจสอบการตั้งค่า"}`);
    } catch (e: any) {
      const msg = e?.message || (typeof e === "string" ? e : JSON.stringify(e));
      toast.error("ทดสอบไม่สำเร็จ: " + msg);
    } finally {
      setTestingAlert(false);
    }
  };

  const toggleTopic = (t: string) =>
    setForm((f) => ({ ...f, topics: f.topics.includes(t) ? f.topics.filter((x) => x !== t) : [...f.topics, t] }));

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3"><CardTitle className="text-lg">LINE Messaging API</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm">Channel Access Token</Label>
            <Input type="password" value={channelToken} onChange={(e) => setChannelToken(e.target.value)} placeholder="กรอก Channel Access Token" className="h-12 rounded-2xl" />
            <p className="text-xs text-muted-foreground">ใช้สำหรับส่งข้อความไปยัง LINE User ID / Group ID ที่กำหนดไว้ด้านล่าง</p>
          </div>
          <Button onClick={saveToken} disabled={savingToken} className="h-11 rounded-2xl w-full sm:w-auto">
            {savingToken ? "กำลังบันทึก..." : "บันทึก Token"}
          </Button>
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-lg">ผู้รับการแจ้งเตือน</CardTitle>
          <Button size="sm" className="rounded-2xl gap-1.5" onClick={() => { setForm({ ...emptyForm }); setOpen(true); }}>
            <Plus className="h-4 w-4" /> เพิ่ม LINE ID
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && <p className="text-sm text-muted-foreground">กำลังโหลด...</p>}
          {!isLoading && recipients.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">ยังไม่มีผู้รับการแจ้งเตือน</p>
          )}
          {recipients.map((r: any) => (
            <div key={r.id} className="rounded-2xl border border-border bg-muted/30 p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-base flex items-center gap-2 flex-wrap">
                    {r.display_name}
                    {!r.is_active && <Badge variant="secondary" className="rounded-xl text-[10px]">ปิดใช้งาน</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground break-all mt-0.5">{r.line_user_id}</p>
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <Button variant="outline" size="sm" className="rounded-2xl" disabled={testingId === r.id} onClick={() => sendTest(r)}>
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => {
                    setForm({ id: r.id, display_name: r.display_name, line_user_id: r.line_user_id, topics: r.topics || [], is_active: r.is_active });
                    setOpen(true);
                  }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-2xl text-destructive" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(r.topics || []).length === 0 ? (
                  <Badge variant="secondary" className="rounded-xl text-[11px]">รับทุกเรื่อง</Badge>
                ) : (
                  (r.topics || []).map((t: string) => (
                    <Badge key={t} variant="outline" className="rounded-xl text-[11px]">
                      {NOTIFICATION_TOPICS.find((x) => x.value === t)?.label || t}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3"><CardTitle className="text-lg">ทดสอบแจ้งเตือนคุณภาพน้ำประจำวัน (16:00 น.)</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            ระบบจะตรวจข้อมูลของวันปัจจุบัน (สารเคมีกำจัดเชื้อโรค (ประปา), ระบบบำบัดน้ำเสีย, ผลตรวจเชื้อ) แล้วส่งสรุปให้ผู้รับที่เลือกหัวข้อ "คุณภาพน้ำ / ระบบบำบัดน้ำเสีย"
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="h-11 rounded-2xl" disabled={testingAlert} onClick={() => testWaterAlert(true)}>
              ดูตัวอย่างข้อความ
            </Button>
            <Button className="h-11 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white" disabled={testingAlert} onClick={() => testWaterAlert(false)}>
              {testingAlert ? "กำลังทดสอบ..." : "ส่งทดสอบตอนนี้"}
            </Button>
          </div>
          {alertPreview && (
            <div className="rounded-xl bg-white px-3 py-3 text-sm text-slate-700 border border-amber-200 whitespace-pre-wrap">{alertPreview}</div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="rounded-3xl max-w-lg w-[95vw] max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? "แก้ไขผู้รับการแจ้งเตือน" : "เพิ่มผู้รับการแจ้งเตือน"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm font-semibold">ชื่อผู้รับ / กลุ่ม</Label>
              <Input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-11 rounded-2xl mt-1" placeholder="เช่น หัวหน้างานสิ่งแวดล้อม" />
            </div>
            <div>
              <Label className="text-sm font-semibold">LINE User ID / Group ID</Label>
              <Input value={form.line_user_id} onChange={(e) => setForm({ ...form, line_user_id: e.target.value })} className="h-11 rounded-2xl mt-1" placeholder="Uxxxxxxxx... หรือ Cxxxxxxxx..." />
            </div>
            <div className="rounded-2xl border border-border p-3 space-y-2 bg-muted/30">
              <Label className="text-sm font-bold">เลือกเรื่องที่ต้องการรับแจ้งเตือน</Label>
              <p className="text-[11px] text-muted-foreground">ถ้าไม่เลือกเลย = รับทุกเรื่อง</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NOTIFICATION_TOPICS.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 rounded-xl bg-background px-3 py-2 cursor-pointer border border-border">
                    <Checkbox checked={form.topics.includes(t.value)} onCheckedChange={() => toggleTopic(t.value)} />
                    <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: !!v })} />
              <span className="text-sm">เปิดใช้งานผู้รับรายนี้</span>
            </label>
            <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="ลบผู้รับการแจ้งเตือน"
        description="ยืนยันการลบผู้รับรายนี้?"
        confirmLabel="ลบ"
        onConfirm={() => { if (deleteId) { remove.mutate(deleteId); setDeleteId(null); } }}
      />
    </div>
  );
}
