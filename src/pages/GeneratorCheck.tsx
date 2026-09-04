import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Zap, Gauge, CalendarClock, Wrench, PlugZap } from "lucide-react";

const emptyForm = {
  machine_code: "",
  check_date: new Date().toISOString().split("T")[0],
  hour_meter: "",
  oil_level: "ปกติ",
  coolant_level: "ปกติ",
  fuel_level: "",
  battery_voltage: "",
  leak_status: "แห้งปกติ / ไม่พบรอยรั่ว",
  ats_status: "อยู่ตำแหน่ง AUTO / ปกติ",
  noload_result: "none",
  rpm: "",
  frequency_hz: "",
  test_start_time: "",
  test_stop_time: "",
  room_cleanliness: "สะอาดเรียบร้อย",
  battery_terminal: "แน่นดี / ไม่มีคราบขี้เกลือ",
  onload_ats: "none",
  voltage_l1: "", voltage_l2: "", voltage_l3: "",
  current_l1: "", current_l2: "", current_l3: "",
  coolant_temp: "",
  oil_pressure: "",
  overall_status: "ready",
  notes: "",
};

const num = (v: string) => (v === "" || v === null ? null : Number(v));

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1">
    <label className="text-[11px] font-bold text-slate-500">{label}</label>
    {children}
  </div>
);

const Pick = ({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) => (
  <Select value={value} onValueChange={onChange}>
    <SelectTrigger className="h-11 text-base sm:text-sm bg-white"><SelectValue /></SelectTrigger>
    <SelectContent className="bg-white z-50">
      {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
    </SelectContent>
  </Select>
);

export default function GeneratorCheck() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("id");
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const { data: machines = [] } = useQuery({
    queryKey: ["generator-machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("generator_machines").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!editId && !form.machine_code && machines.length > 0) {
      set("machine_code", (machines[0] as any).code);
    }
  }, [machines, editId, form.machine_code]);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    if (!editId) return;
    (async () => {
      const { data } = await supabase.from("generator_checks").select("*").eq("id", editId).maybeSingle();
      if (!data) return;
      const next: any = { ...emptyForm };
      Object.keys(emptyForm).forEach((k) => {
        const v = (data as any)[k];
        if (v !== null && v !== undefined) next[k] = String(v);
      });
      next.noload_result = data.noload_result || "none";
      next.onload_ats = data.onload_ats || "none";
      setForm(next);
    })();
  }, [editId]);

  const duration = useMemo(() => {
    if (!form.test_start_time || !form.test_stop_time) return null;
    const [sh, sm] = form.test_start_time.split(":").map(Number);
    const [eh, em] = form.test_stop_time.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm);
    if (mins < 0) mins += 24 * 60;
    return mins;
  }, [form.test_start_time, form.test_stop_time]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = {
        machine_code: form.machine_code.trim(),
        check_date: form.check_date,
        recorder_id: user?.id ?? null,
        recorder_name: profile?.full_name || "ไม่ระบุชื่อ",
        hour_meter: num(form.hour_meter),
        oil_level: form.oil_level,
        coolant_level: form.coolant_level,
        fuel_level: form.fuel_level || null,
        battery_voltage: num(form.battery_voltage),
        leak_status: form.leak_status,
        ats_status: form.ats_status,
        noload_result: form.noload_result === "none" ? null : form.noload_result,
        rpm: num(form.rpm),
        frequency_hz: num(form.frequency_hz),
        test_start_time: form.test_start_time || null,
        test_stop_time: form.test_stop_time || null,
        test_duration_min: duration,
        room_cleanliness: form.room_cleanliness,
        battery_terminal: form.battery_terminal,
        onload_ats: form.onload_ats === "none" ? null : form.onload_ats,
        voltage_l1: num(form.voltage_l1), voltage_l2: num(form.voltage_l2), voltage_l3: num(form.voltage_l3),
        current_l1: num(form.current_l1), current_l2: num(form.current_l2), current_l3: num(form.current_l3),
        coolant_temp: num(form.coolant_temp),
        oil_pressure: num(form.oil_pressure),
        overall_status: form.overall_status,
        notes: form.notes || null,
      };
      if (editId) {
        const { error } = await supabase.from("generator_checks").update(payload).eq("id", editId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("generator_checks").insert(payload);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["generator-checks"] });
      toast({ title: editId ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกการตรวจเช็คเครื่องปั่นไฟสำเร็จ" });
      navigate("/electricity");
    } catch (e: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-1 sm:px-0 space-y-4 pb-28 overflow-x-hidden">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => navigate("/electricity")} className="h-10 text-xs sm:text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
        </Button>
        <span className="text-[11px] text-slate-500">ผู้บันทึก: <b className="text-slate-700">{profile?.full_name || "-"}</b></span>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50 border-b py-3 px-4">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" /> {editId ? "แก้ไข" : "แบบ"}บันทึกการตรวจเช็คเครื่องปั่นไฟ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="เครื่องปั่นไฟ">
            {machines.length > 0 ? (
              <Pick
                value={form.machine_code}
                onChange={(v) => set("machine_code", v)}
                options={machines.map((m: any) => ({ value: m.code, label: `${m.code} — ${m.name}` }))}
              />
            ) : (
              <Input value={form.machine_code} onChange={(e) => set("machine_code", e.target.value)} placeholder="เพิ่มเครื่องในหน้าตั้งค่า" className="h-11 text-sm" />
            )}
          </Field>
          <Field label="วันที่ตรวจ">
            <Input type="date" value={form.check_date} onChange={(e) => set("check_date", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="ชั่วโมงการทำงานสะสม (Hour Meter)">
            <Input type="number" value={form.hour_meter} onChange={(e) => set("hour_meter", e.target.value)} placeholder="ชม." className="h-11 text-base sm:text-sm" />
          </Field>
        </CardContent>
      </Card>

      {/* ส่วนที่ 1 */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-2.5 px-4">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><Gauge className="h-4 w-4 text-indigo-500" /> ส่วนที่ 1: ตรวจสอบประจำวัน (Daily Standby Check)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ระดับน้ำมันเครื่อง">
            <Pick value={form.oil_level} onChange={(v) => set("oil_level", v)} options={[
              { value: "ปกติ", label: "ปกติ" }, { value: "ต่ำกว่าเกณฑ์", label: "ต่ำกว่าเกณฑ์" }, { value: "สูงกว่าเกณฑ์", label: "สูงกว่าเกณฑ์" },
            ]} />
          </Field>
          <Field label="ระดับน้ำหล่อเย็น / หม้อพัก">
            <Pick value={form.coolant_level} onChange={(v) => set("coolant_level", v)} options={[
              { value: "ปกติ", label: "ปกติ" }, { value: "ต่ำกว่าเกณฑ์", label: "ต่ำกว่าเกณฑ์" },
            ]} />
          </Field>
          <Field label="ระดับน้ำมันเชื้อเพลิง (ลิตร / %)">
            <Input value={form.fuel_level} onChange={(e) => set("fuel_level", e.target.value)} placeholder="เช่น 120 ลิตร หรือ 80%" className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="แรงดันแบตเตอรี่ Standby (V)">
            <Input type="number" step="0.1" value={form.battery_voltage} onChange={(e) => set("battery_voltage", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="สภาพแวดล้อม / การรั่วซึม">
            <Pick value={form.leak_status} onChange={(v) => set("leak_status", v)} options={[
              { value: "แห้งปกติ / ไม่พบรอยรั่ว", label: "แห้งปกติ / ไม่พบรอยรั่ว" },
              { value: "พบคราบน้ำมัน/น้ำรั่วซึม", label: "พบคราบน้ำมัน/น้ำรั่วซึม" },
            ]} />
          </Field>
          <Field label="ตู้ ATS / เบรกเกอร์ / สวิตช์ Auto">
            <Pick value={form.ats_status} onChange={(v) => set("ats_status", v)} options={[
              { value: "อยู่ตำแหน่ง AUTO / ปกติ", label: "อยู่ตำแหน่ง AUTO / ปกติ" },
              { value: "ผิดปกติ / อยู่ตำแหน่ง MANUAL", label: "ผิดปกติ / อยู่ตำแหน่ง MANUAL" },
            ]} />
          </Field>
        </CardContent>
      </Card>

      {/* ส่วนที่ 2 */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-2.5 px-4">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><CalendarClock className="h-4 w-4 text-emerald-500" /> ส่วนที่ 2: ทดสอบเดินเครื่องประจำสัปดาห์ (No-Load Test)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="ผลการเดินเครื่องเปล่า (No-Load)">
              <Pick value={form.noload_result} onChange={(v) => set("noload_result", v)} options={[
                { value: "none", label: "-- ไม่ได้ทดสอบวันนี้ --" },
                { value: "🟢 ปกติ (Auto Test ทำงานปกติ)", label: "🟢 ปกติ (Auto Test ทำงานปกติ)" },
                { value: "🔵 ปกติ (ช่างสตาร์ททดสอบเอง)", label: "🔵 ปกติ (ช่างสตาร์ททดสอบเอง)" },
                { value: "🔴 ผิดปกติ (เครื่องไม่สตาร์ท / มีสัญญาณเตือน)", label: "🔴 ผิดปกติ (เครื่องไม่สตาร์ท / มีสัญญาณเตือน)" },
              ]} />
            </Field>
          </div>
          <Field label="รอบเครื่องยนต์ (RPM)">
            <Input type="number" value={form.rpm} onChange={(e) => set("rpm", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="ความถี่ไฟฟ้า (Hz)">
            <Input type="number" step="0.1" value={form.frequency_hz} onChange={(e) => set("frequency_hz", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="เวลาเริ่มทดสอบ">
            <Input type="time" value={form.test_start_time} onChange={(e) => set("test_start_time", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <Field label="เวลาหยุดทดสอบ">
            <Input type="time" value={form.test_stop_time} onChange={(e) => set("test_stop_time", e.target.value)} className="h-11 text-base sm:text-sm" />
          </Field>
          <div className="sm:col-span-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-sm font-bold text-emerald-700">
            ระยะเวลาทดสอบ: {duration === null ? "-" : `${duration} นาที`}
          </div>
        </CardContent>
      </Card>

      {/* ส่วนที่ 3 */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-2.5 px-4">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><Wrench className="h-4 w-4 text-blue-500" /> ส่วนที่ 3: บำรุงรักษาประจำเดือน</CardTitle>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="ความสะอาดห้องเครื่อง / ตัวเครื่อง">
            <Pick value={form.room_cleanliness} onChange={(v) => set("room_cleanliness", v)} options={[
              { value: "สะอาดเรียบร้อย", label: "สะอาดเรียบร้อย" }, { value: "ทำความสะอาดแล้ว", label: "ทำความสะอาดแล้ว" },
            ]} />
          </Field>
          <Field label="ขั้วแบตเตอรี่ / คราบขี้เกลือ">
            <Pick value={form.battery_terminal} onChange={(v) => set("battery_terminal", v)} options={[
              { value: "แน่นดี / ไม่มีคราบขี้เกลือ", label: "แน่นดี / ไม่มีคราบขี้เกลือ" }, { value: "ทำความสะอาดขั้วแล้ว", label: "ทำความสะอาดขั้วแล้ว" },
            ]} />
          </Field>
        </CardContent>
      </Card>

      {/* ส่วนที่ 4 */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-2.5 px-4">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><PlugZap className="h-4 w-4 text-rose-500" /> ส่วนที่ 4: ไฟฟ้าดับจริง / ทดสอบจ่ายไฟพร้อมโหลด (On-Load Test)</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Field label="การสลับโหลดของ ATS">
            <Pick value={form.onload_ats} onChange={(v) => set("onload_ats", v)} options={[
              { value: "none", label: "-- ไม่ได้จ่ายโหลด --" },
              { value: "สลับจ่ายไฟเข้าอาคารปกติ", label: "สลับจ่ายไฟเข้าอาคารปกติ" },
              { value: "ATS ไม่สลับไฟ", label: "ATS ไม่สลับไฟ" },
            ]} />
          </Field>
          <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-2">
            {(["voltage_l1", "voltage_l2", "voltage_l3"] as const).map((k, i) => (
              <Field key={k} label={`แรงดัน L${i + 1} (V)`}>
                <Input type="number" value={(form as any)[k]} onChange={(e) => set(k, e.target.value)} className="h-11 text-base sm:text-sm" />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-2">
            {(["current_l1", "current_l2", "current_l3"] as const).map((k, i) => (
              <Field key={k} label={`กระแสโหลด L${i + 1} (A)`}>
                <Input type="number" value={(form as any)[k]} onChange={(e) => set(k, e.target.value)} className="h-11 text-base sm:text-sm" />
              </Field>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="อุณหภูมิน้ำหล่อเย็นขณะมีโหลด (°C)">
              <Input type="number" step="0.1" value={form.coolant_temp} onChange={(e) => set("coolant_temp", e.target.value)} className="h-11 text-base sm:text-sm" />
            </Field>
            <Field label="ความดันน้ำมันเครื่อง (PSI/kPa)">
              <Input type="number" step="0.1" value={form.oil_pressure} onChange={(e) => set("oil_pressure", e.target.value)} className="h-11 text-base sm:text-sm" />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* สรุปผล */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-2.5 px-4">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700">สรุปผลการตรวจ</CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Field label="สถานะภาพรวมเครื่องปั่นไฟ">
            <Pick value={form.overall_status} onChange={(v) => set("overall_status", v)} options={[
              { value: "ready", label: "🟢 เครื่องพร้อมใช้งานปกติ (Ready)" },
              { value: "warning", label: "🟡 พบข้อบกพร่อง/เฝ้าระวัง (Warning)" },
              { value: "out_of_service", label: "🔴 ไม่พร้อมใช้งาน/ต้องซ่อมด่วน (Out of Service)" },
            ]} />
          </Field>
          <Field label="ข้อสังเกต / รายละเอียดเพิ่มเติม">
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} className="text-sm" />
          </Field>
          <div className="flex flex-col sm:flex-row gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving} className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
              <Save className="mr-2 h-4 w-4" /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
            <Button variant="outline" onClick={() => navigate("/electricity")} className="h-12 rounded-xl sm:w-40">
              <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
