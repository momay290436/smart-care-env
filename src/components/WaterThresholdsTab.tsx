import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, RotateCcw, Droplets, FlaskConical } from "lucide-react";

export const DEFAULT_WATER_THRESHOLDS = {
  potable: { chlorineMin: 0.2, chlorineMax: 0.5, phMin: 6.5, phMax: 8.5, turbidityMax: 5 },
  wastewater: {
    chlorineMin: 0.5,
    chlorineMax: 1,
    phMin: 6.5,
    phMax: 8.5,
    doMin: 2,
    doMax: 3,
    doWarnMin: 1,
    sedimentBadLow: 100,
    sedimentWarnLow: 200,
    sedimentNormalMin: 250,
    sedimentNormalMax: 450,
    sedimentWarnHigh: 350,
    sedimentBadHigh: 450,
  },
};

type Thresholds = typeof DEFAULT_WATER_THRESHOLDS;

const POTABLE_FIELDS: { key: keyof Thresholds["potable"]; label: string; hint: string }[] = [
  { key: "chlorineMin", label: "คลอรีนต่ำสุด (mg/L)", hint: "ต่ำกว่านี้ = วิกฤติ (แดง)" },
  { key: "chlorineMax", label: "คลอรีนสูงสุด (mg/L)", hint: "เกินนี้ = วิกฤติ (แดง)" },
  { key: "phMin", label: "pH ต่ำสุด", hint: "ต้นทาง/ปลายทาง ต่ำกว่านี้ = วิกฤติ" },
  { key: "phMax", label: "pH สูงสุด", hint: "ต้นทาง/ปลายทาง เกินนี้ = วิกฤติ" },
  { key: "turbidityMax", label: "ความขุ่นสูงสุด (NTU)", hint: "เกินนี้ = เฝ้าระวัง (เหลือง)" },
];

const WASTE_FIELDS: { key: keyof Thresholds["wastewater"]; label: string; hint: string }[] = [
  { key: "chlorineMin", label: "คลอรีนต่ำสุด (mg/L)", hint: "ต่ำกว่านี้ = เฝ้าระวัง (เหลือง)" },
  { key: "chlorineMax", label: "คลอรีนสูงสุด (mg/L)", hint: "เกินนี้ = วิกฤติ (แดง)" },
  { key: "phMin", label: "pH ต่ำสุด", hint: "ต่ำกว่านี้ = วิกฤติ" },
  { key: "phMax", label: "pH สูงสุด", hint: "เกินนี้ = วิกฤติ" },
  { key: "doWarnMin", label: "DO ขีดวิกฤติล่าง (mg/L)", hint: "ต่ำกว่านี้ = วิกฤติ" },
  { key: "doMin", label: "DO ปกติต่ำสุด (mg/L)", hint: "ระหว่างวิกฤติล่างถึงค่านี้ = เฝ้าระวัง" },
  { key: "doMax", label: "DO ปกติสูงสุด (mg/L)", hint: "เกินนี้ = วิกฤติ" },
  { key: "sedimentBadLow", label: "ตะกอน วิกฤติต่ำกว่า", hint: "ต่ำกว่านี้ = วิกฤติ" },
  { key: "sedimentWarnLow", label: "ตะกอน เฝ้าระวังถึง", hint: "ระหว่างวิกฤติต่ำถึงค่านี้ = เฝ้าระวัง" },
  { key: "sedimentNormalMin", label: "ตะกอน ปกติต่ำสุด", hint: "ใช้แสดงช่วงค่าปกติในข้อความ" },
  { key: "sedimentWarnHigh", label: "ตะกอน เฝ้าระวังเกิน", hint: "เกินค่านี้ = เฝ้าระวัง" },
  { key: "sedimentNormalMax", label: "ตะกอน ปกติสูงสุด", hint: "ใช้แสดงช่วงค่าปกติในข้อความ" },
  { key: "sedimentBadHigh", label: "ตะกอน วิกฤติเกิน", hint: "เกินค่านี้ = วิกฤติ" },
];

export default function WaterThresholdsTab() {
  const [values, setValues] = useState<Thresholds>(DEFAULT_WATER_THRESHOLDS);
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["water-thresholds"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "water_thresholds").maybeSingle();
      return data?.value || "";
    },
  });

  useEffect(() => {
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      setValues({
        potable: { ...DEFAULT_WATER_THRESHOLDS.potable, ...(parsed.potable || {}) },
        wastewater: { ...DEFAULT_WATER_THRESHOLDS.wastewater, ...(parsed.wastewater || {}) },
      });
    } catch {
      /* ignore malformed setting */
    }
  }, [data]);

  const save = async () => {
    setSaving(true);
    try {
      const payload = JSON.stringify(values);
      const { data: existing } = await supabase.from("app_settings").select("id").eq("key", "water_thresholds").maybeSingle();
      if (existing) {
        const { error } = await supabase.from("app_settings").update({ value: payload }).eq("key", "water_thresholds");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("app_settings").insert({ key: "water_thresholds", value: payload });
        if (error) throw error;
      }
      toast.success("บันทึกเกณฑ์ค่ามาตรฐานสำเร็จ");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderField = (
    group: "potable" | "wastewater",
    field: { key: string; label: string; hint: string },
  ) => (
    <div key={`${group}-${field.key}`}>
      <Label className="text-sm font-semibold">{field.label}</Label>
      <Input
        type="number"
        step="0.1"
        inputMode="decimal"
        className="h-11 rounded-2xl mt-1"
        value={(values as any)[group][field.key]}
        onChange={(e) =>
          setValues((v) => ({
            ...v,
            [group]: { ...(v as any)[group], [field.key]: e.target.value === "" ? "" : Number(e.target.value) },
          }))
        }
      />
      <p className="text-xs text-muted-foreground mt-1">{field.hint}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Droplets className="h-5 w-5 text-sky-600" /> เกณฑ์น้ำประปา (ต้นทาง/ปลายทาง)
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {POTABLE_FIELDS.map((f) => renderField("potable", f as any))}
        </CardContent>
      </Card>

      <Card className="shadow-card border-0 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-emerald-600" /> เกณฑ์ระบบบำบัดน้ำเสีย
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WASTE_FIELDS.map((f) => renderField("wastewater", f as any))}
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row gap-2">
        <Button className="h-12 rounded-2xl font-bold flex-1 gap-2" onClick={save} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? "กำลังบันทึก..." : "บันทึกเกณฑ์"}
        </Button>
        <Button
          variant="outline"
          className="h-12 rounded-2xl gap-2"
          onClick={() => { setValues(DEFAULT_WATER_THRESHOLDS); toast.info("คืนค่าเริ่มต้นแล้ว (กดบันทึกเพื่อยืนยัน)"); }}
        >
          <RotateCcw className="h-4 w-4" /> คืนค่าเริ่มต้น
        </Button>
      </div>
    </div>
  );
}
