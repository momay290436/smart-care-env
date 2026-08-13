import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";

export const DEFAULT_WATER_ALERT_TEMPLATE = [
  "🚱 แจ้งเตือนคุณภาพน้ำ {date}",
  "",
  "{critical_section}",
  "{warning_section}",
  "โปรดตรวจสอบและแก้ไขโดยด่วน",
].join("\n");

const VARIABLES: { key: string; desc: string }[] = [
  { key: "{date}", desc: "วันที่ (ไทย)" },
  { key: "{critical_section}", desc: "บล็อกรายการวิกฤติพร้อมหัวข้อ" },
  { key: "{warning_section}", desc: "บล็อกรายการเฝ้าระวังพร้อมหัวข้อ" },
  { key: "{critical_list}", desc: "รายการวิกฤติอย่างเดียว" },
  { key: "{warning_list}", desc: "รายการเฝ้าระวังอย่างเดียว" },
  { key: "{water_quality_status}", desc: "สถานะน้ำประปา" },
  { key: "{wastewater_status}", desc: "สถานะระบบบำบัดน้ำเสีย" },
  { key: "{lab_results}", desc: "ผลตรวจเชื้อจุลินทรีย์" },
  { key: "{total_count}", desc: "จำนวนรายการผิดปกติทั้งหมด" },
  { key: "{critical_count}", desc: "จำนวนรายการวิกฤติ" },
  { key: "{warning_count}", desc: "จำนวนรายการเฝ้าระวัง" },
];

const TEMPLATE_KEY = "water_alert_template";
const SKIP_KEY = "water_alert_skip_dates";

const todayStr = () => format(new Date(), "yyyy-MM-dd");

const upsertSetting = async (key: string, value: string) => {
  const { data: existing } = await supabase.from("app_settings").select("id").eq("key", key).maybeSingle();
  if (existing) {
    const { error } = await supabase.from("app_settings").update({ value }).eq("key", key);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("app_settings").insert({ key, value });
    if (error) throw error;
  }
};

export default function NotificationTemplateSettings() {
  const queryClient = useQueryClient();
  const [template, setTemplate] = useState(DEFAULT_WATER_ALERT_TEMPLATE);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [savingSkip, setSavingSkip] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["water-alert-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key, value").in("key", [TEMPLATE_KEY, SKIP_KEY]);
      if (error) throw error;
      return data || [];
    },
  });

  const savedTemplate = useMemo(
    () => (settings || []).find((s: any) => s.key === TEMPLATE_KEY)?.value || "",
    [settings],
  );

  const skipDates: string[] = useMemo(() => {
    const raw = (settings || []).find((s: any) => s.key === SKIP_KEY)?.value;
    try {
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }, [settings]);

  useEffect(() => {
    if (loaded || !settings) return;
    setTemplate(savedTemplate || DEFAULT_WATER_ALERT_TEMPLATE);
    setLoaded(true);
  }, [settings, savedTemplate, loaded]);

  const skippedToday = skipDates.includes(todayStr());

  const persistSkip = async (next: string[]) => {
    setSavingSkip(true);
    try {
      await upsertSetting(SKIP_KEY, JSON.stringify(Array.from(new Set(next)).sort()));
      await queryClient.invalidateQueries({ queryKey: ["water-alert-settings"] });
      toast.success("บันทึกปฏิทินงดส่งแจ้งเตือนแล้ว");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSavingSkip(false);
    }
  };

  const toggleToday = (on: boolean) => {
    const t = todayStr();
    persistSkip(on ? [...skipDates, t] : skipDates.filter((d) => d !== t));
  };

  const onSelectDays = (days: Date[] | undefined) => {
    persistSkip((days || []).map((d) => format(d, "yyyy-MM-dd")));
  };

  const saveTemplate = async () => {
    setSaving(true);
    try {
      await upsertSetting(TEMPLATE_KEY, template);
      await queryClient.invalidateQueries({ queryKey: ["water-alert-settings"] });
      toast.success("บันทึกแม่แบบข้อความสำเร็จ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetTemplate = async () => {
    setTemplate(DEFAULT_WATER_ALERT_TEMPLATE);
    setSaving(true);
    try {
      await upsertSetting(TEMPLATE_KEY, DEFAULT_WATER_ALERT_TEMPLATE);
      await queryClient.invalidateQueries({ queryKey: ["water-alert-settings"] });
      toast.success("คืนค่าเริ่มต้นแล้ว");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const livePreview = async () => {
    setPreviewing(true);
    setPreview("");
    try {
      const { data, error } = await supabase.functions.invoke("water-alert-daily", {
        body: { dryRun: true, template },
      });
      if (error) throw error;
      setPreview(data?.message || "วันนี้ไม่พบข้อมูลผิดปกติ");
    } catch (e: any) {
      toast.error("ดูตัวอย่างไม่สำเร็จ: " + (e?.message || ""));
    } finally {
      setPreviewing(false);
    }
  };

  const selectedDays = useMemo(
    () => skipDates.map((d) => new Date(d + "T00:00:00")),
    [skipDates],
  );

  return (
    <Card className="shadow-card border-0 rounded-2xl">
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0 gap-2 flex-wrap">
        <CardTitle className="text-lg">จัดการ Template &amp; การส่งประจำวัน</CardTitle>
        <Badge
          className={`rounded-xl ${skippedToday ? "bg-amber-100 text-amber-800 hover:bg-amber-100" : "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"}`}
        >
          สถานะ: {skippedToday ? "งดส่งวันนี้" : "ปกติ (ส่ง 16:00 น.)"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-semibold">แม่แบบข้อความสรุปประจำวัน</Label>
          <Textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={10}
            className="rounded-2xl font-mono text-sm leading-relaxed"
          />
          <div className="flex flex-wrap gap-1.5">
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                title={v.desc}
                onClick={() => setTemplate((t) => `${t}${t.endsWith("\n") || t === "" ? "" : "\n"}${v.key}`)}
                className="rounded-xl border border-border bg-muted/40 px-2 py-1 text-[11px] font-mono hover:bg-muted"
              >
                {v.key}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button className="h-11 rounded-2xl font-bold" onClick={saveTemplate} disabled={saving}>
              {saving ? "กำลังบันทึก..." : "บันทึกแม่แบบข้อความ"}
            </Button>
            <Button variant="outline" className="h-11 rounded-2xl" onClick={resetTemplate} disabled={saving}>
              คืนค่าเริ่มต้น
            </Button>
            <Button variant="outline" className="h-11 rounded-2xl" onClick={livePreview} disabled={previewing}>
              {previewing ? "กำลังสร้างตัวอย่าง..." : "ดูตัวอย่างข้อความที่แก้ไข"}
            </Button>
          </div>
          {preview && (
            <div className="rounded-2xl border border-border bg-muted/30 px-3 py-3 text-sm whitespace-pre-wrap">{preview}</div>
          )}
        </div>

        <div className="rounded-2xl border border-border p-4 space-y-4 bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">งดส่งแจ้งเตือนวันนี้</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(), "d MMMM yyyy", { locale: th })}
              </p>
            </div>
            <Switch checked={skippedToday} disabled={savingSkip} onCheckedChange={toggleToday} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">ปฏิทินงดส่งแจ้งเตือน (เลือกวันล่วงหน้าได้)</Label>
            <div className="rounded-2xl border border-border bg-background p-2 overflow-x-auto">
              <Calendar
                mode="multiple"
                selected={selectedDays}
                onSelect={onSelectDays as any}
                locale={th}
                className="pointer-events-auto"
              />
            </div>
            {skipDates.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {skipDates.map((d) => (
                  <Badge key={d} variant="outline" className="rounded-xl text-[11px]">
                    {format(new Date(d + "T00:00:00"), "d MMM yy", { locale: th })}
                  </Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">ยังไม่มีวันที่งดส่งแจ้งเตือน</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
