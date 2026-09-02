import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Camera, X, Waves, Wind, Printer, Save, Pencil, Trash2, CheckCircle2 } from "lucide-react";

declare global { interface Window { Html5Qrcode: any } }

const THAI_MONTHS = ["มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];
const today = () => new Date().toISOString().split("T")[0];
const nowTime = () => new Date().toTimeString().slice(0, 5);
const beYear = (y: number) => y + 543;

export default function PumpMeters() {
  const navigate = useNavigate();
  const { profile, user, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isScanning, setIsScanning] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [machineId, setMachineId] = useState("");
  const [recordDate, setRecordDate] = useState(today());
  const [recordTime, setRecordTime] = useState(nowTime());
  const [meterReading, setMeterReading] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [filterMachine, setFilterMachine] = useState("all");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const { data: machines = [] } = useQuery({
    queryKey: ["pump-machines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("pump_machines").select("*").order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: logs = [] } = useQuery({
    queryKey: ["pump-meter-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pump_meter_logs")
        .select("*, pump_machines(name, machine_type)")
        .order("record_date", { ascending: false })
        .order("record_time", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const todayStr = today();
  const doneToday = useMemo(() => new Set(logs.filter((l: any) => l.record_date === todayStr).map((l: any) => l.machine_id)), [logs, todayStr]);

  const lastReading = useMemo(() => {
    if (!machineId) return null;
    const prev = logs
      .filter((l: any) => l.machine_id === machineId && l.id !== editId)
      .sort((a: any, b: any) => `${b.record_date}${b.record_time}`.localeCompare(`${a.record_date}${a.record_time}`))[0];
    return prev ? Number(prev.meter_reading) : null;
  }, [logs, machineId, editId]);

  const hoursUsed = useMemo(() => {
    if (meterReading === "" || lastReading === null) return null;
    return Math.round((Number(meterReading) - lastReading) * 100) / 100;
  }, [meterReading, lastReading]);

  // ---------- QR scanner ----------
  useEffect(() => {
    if (!isScanning) return;
    let scanner: any;
    const load = async () => {
      if (!window.Html5Qrcode) {
        await new Promise<void>((res, rej) => {
          const s = document.createElement("script");
          s.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
          s.onload = () => res(); s.onerror = () => rej();
          document.body.appendChild(s);
        });
      }
      scanner = new window.Html5Qrcode("pump-reader");
      await scanner.start({ facingMode: { exact: "environment" } }, { fps: 10, qrbox: 250 }, (text: string) => {
        const found = machines.find((m: any) => m.qr_code_data === text || m.name === text || m.id === text);
        if (found) {
          openNew(found.id);
          setIsScanning(false);
        } else {
          toast({ variant: "destructive", title: "ไม่พบเครื่องที่ตรงกับคิวอาร์นี้" });
        }
      }, () => {}).catch(async () => {
        await scanner.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, (text: string) => {
          const found = machines.find((m: any) => m.qr_code_data === text || m.name === text || m.id === text);
          if (found) { openNew(found.id); setIsScanning(false); }
        }, () => {});
      });
    };
    load();
    return () => { if (scanner?.stop) scanner.stop().catch(() => {}); };
  }, [isScanning, machines]);

  const openNew = (id: string) => {
    setEditId(null);
    setMachineId(id);
    setRecordDate(today());
    setRecordTime(nowTime());
    setMeterReading("");
    setNotes("");
    setOpenForm(true);
  };

  const openEdit = (log: any) => {
    setEditId(log.id);
    setMachineId(log.machine_id);
    setRecordDate(log.record_date);
    setRecordTime(String(log.record_time).slice(0, 5));
    setMeterReading(String(log.meter_reading));
    setNotes(log.notes || "");
    setOpenForm(true);
  };

  const handleSave = async () => {
    if (!machineId || meterReading === "") {
      return toast({ variant: "destructive", title: "กรุณาเลือกเครื่องและระบุเลขมิเตอร์" });
    }
    setSaving(true);
    try {
      const payload: any = {
        machine_id: machineId,
        record_date: recordDate,
        record_time: recordTime,
        meter_reading: Number(meterReading),
        previous_reading: lastReading,
        hours_used: hoursUsed,
        recorder_id: user?.id ?? null,
        recorder_name: profile?.full_name || "ไม่ระบุชื่อ",
        notes: notes || null,
      };
      const { error } = editId
        ? await supabase.from("pump_meter_logs").update(payload).eq("id", editId)
        : await supabase.from("pump_meter_logs").insert(payload);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["pump-meter-logs"] });
      toast({ title: editId ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกมิเตอร์สำเร็จ" });
      setOpenForm(false);
    } catch (e: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("ยืนยันการลบรายการนี้?")) return;
    const { error } = await supabase.from("pump_meter_logs").delete().eq("id", id);
    if (error) return toast({ variant: "destructive", title: "ลบไม่สำเร็จ", description: error.message });
    queryClient.invalidateQueries({ queryKey: ["pump-meter-logs"] });
    toast({ title: "ลบรายการสำเร็จ" });
  };

  const filteredLogs = useMemo(() => logs.filter((l: any) => {
    if (filterMachine !== "all" && l.machine_id !== filterMachine) return false;
    if (filterMonth && !String(l.record_date).startsWith(filterMonth)) return false;
    return true;
  }), [logs, filterMachine, filterMonth]);

  const selectedMachine = machines.find((m: any) => m.id === filterMachine);

  const exportPdf = () => {
    const [y, m] = filterMonth.split("-").map(Number);
    const name = selectedMachine?.name || "ทุกเครื่อง";
    const type = selectedMachine?.machine_type || "เครื่องสูบน้ำเสีย / เครื่องเติมอากาศ";
    const rows = [...filteredLogs].sort((a: any, b: any) => `${a.record_date}${a.record_time}`.localeCompare(`${b.record_date}${b.record_time}`));
    const body = rows.map((r: any, i: number) => `<tr>
      <td>${i + 1}</td>
      <td>${new Date(r.record_date).toLocaleDateString("th-TH", { dateStyle: "short" })}</td>
      <td>${String(r.record_time).slice(0, 5)}</td>
      <td>${Number(r.meter_reading).toLocaleString()}</td>
      <td>${r.hours_used === null || r.hours_used === undefined ? "-" : Number(r.hours_used).toLocaleString()}</td>
      <td>${r.recorder_name || "-"}</td>
      <td>${r.notes || ""}</td>
    </tr>`).join("");

    const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>รายงานมิเตอร์ ${name}</title>
    <style>
      @page { size: A4; margin: 18mm; }
      body { font-family: "Sarabun","TH SarabunPSK","Tahoma",sans-serif; color:#000; }
      .cover { height: 240mm; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; gap:14px; page-break-after: always; }
      .cover h1 { font-size: 30px; margin:0; }
      .cover h2 { font-size: 26px; margin:0; }
      table { width:100%; border-collapse: collapse; }
      th, td { border:1px solid #000; padding:6px 4px; font-size:14px; text-align:center; }
      th { background:#f1f1f1; }
      h3 { text-align:center; font-size:18px; margin: 0 0 10px; }
    </style></head><body>
      <div class="cover">
        <h1>รายงานตรวจบันทึกการทำงาน</h1>
        <h2>ชั่วโมงมิเตอร์${type}</h2>
        <h2>${name}</h2>
        <h2>หน่วยงาน ระบบบำบัดน้ำเสีย</h2>
        <h2>โรงพยาบาลแม่สรวย</h2>
        <h2>ประจำปี ${beYear(y)}</h2>
      </div>
      <h3>ตาราง${name} ประจำเดือน ${THAI_MONTHS[m - 1]} ${beYear(y)}</h3>
      <table>
        <thead><tr>
          <th style="width:8%">ลำดับ</th><th style="width:14%">วันที่</th><th style="width:10%">เวลา</th>
          <th style="width:18%">เลขมิเตอร์</th><th style="width:16%">ชั่วโมงที่ใช้</th>
          <th style="width:16%">ผู้บันทึก</th><th>หมายเหตุ</th>
        </tr></thead>
        <tbody>${body || `<tr><td colspan="7">ไม่มีข้อมูล</td></tr>`}</tbody>
      </table>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) return toast({ variant: "destructive", title: "กรุณาอนุญาต Pop-up เพื่อพิมพ์รายงาน" });
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 400);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" onClick={() => navigate("/electricity")} className="h-10 text-xs sm:text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" /> ย้อนกลับ
        </Button>
        <span className="text-[11px] text-slate-500">ผู้บันทึก: <b className="text-slate-700">{profile?.full_name || "-"}</b></span>
      </div>

      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b py-3 px-4">
          <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2">
            <Waves className="h-4 w-4 text-teal-600" /> มิเตอร์ชั่วโมงเครื่องสูบน้ำเสีย / เครื่องเติมอากาศ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          {!isScanning ? (
            <Button onClick={() => setIsScanning(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white py-4 rounded-xl text-xs sm:text-sm font-bold">
              <Camera className="mr-2 h-4 w-4" /> สแกนคิวอาร์เครื่องเพื่อบันทึกมิเตอร์
            </Button>
          ) : (
            <div className="relative max-w-[320px] mx-auto aspect-square w-full border-4 border-teal-500 rounded-2xl overflow-hidden bg-black">
              <div id="pump-reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full" />
              <Button onClick={() => setIsScanning(false)} size="sm" variant="destructive" className="absolute top-3 right-3 rounded-full h-8 w-8 p-0 z-50">
                <X className="h-4 w-4 text-white" />
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {machines.map((m: any) => {
              const done = doneToday.has(m.id);
              const isAerator = String(m.machine_type).includes("เติมอากาศ");
              return (
                <button
                  key={m.id}
                  onClick={() => openNew(m.id)}
                  className="text-left p-3 rounded-2xl border bg-white hover:shadow-md transition-all active:scale-[0.98] border-slate-200"
                >
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-xl ${isAerator ? "bg-sky-50 text-sky-600" : "bg-teal-50 text-teal-600"}`}>
                      {isAerator ? <Wind className="h-4 w-4" /> : <Waves className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{m.name}</p>
                      <p className="text-[10px] text-slate-500 truncate">{m.machine_type}</p>
                    </div>
                  </div>
                  <div className="mt-2">
                    {done ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" /> บันทึกวันนี้แล้ว
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">ยังไม่บันทึกวันนี้</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ประวัติ */}
      <Card className="rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50 border-b py-3 px-4 space-y-2">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700">ประวัติการบันทึกมิเตอร์ชั่วโมงทำงาน</CardTitle>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={filterMachine} onValueChange={setFilterMachine}>
              <SelectTrigger className="h-9 text-xs bg-white sm:w-64"><SelectValue placeholder="เลือกเครื่อง" /></SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="all">ทุกเครื่อง</SelectItem>
                {machines.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="h-9 text-xs bg-white sm:w-48" />
            <Button onClick={exportPdf} className="h-9 text-xs bg-rose-600 hover:bg-rose-700 text-white rounded-xl">
              <Printer className="mr-2 h-3.5 w-3.5" /> พิมพ์ / บันทึก PDF
            </Button>
          </div>
        </CardHeader>
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600">ลำดับ</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 whitespace-nowrap">วันที่</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600">เวลา</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 whitespace-nowrap">ชื่อเครื่อง</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 text-right whitespace-nowrap">เลขมิเตอร์</TableHead>
                <TableHead className="text-xs font-bold text-teal-600 text-right whitespace-nowrap">ชั่วโมงที่ใช้</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 whitespace-nowrap">ผู้บันทึก / หมายเหตุ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-xs text-slate-400">ไม่พบข้อมูลตามเงื่อนไข</TableCell></TableRow>
              ) : filteredLogs.map((l: any, i: number) => (
                <TableRow key={l.id} className="hover:bg-slate-50/50">
                  <TableCell className="text-xs text-slate-500">{i + 1}</TableCell>
                  <TableCell className="text-xs text-slate-600 whitespace-nowrap">{new Date(l.record_date).toLocaleDateString("th-TH", { dateStyle: "medium" })}</TableCell>
                  <TableCell className="text-xs text-slate-600">{String(l.record_time).slice(0, 5)}</TableCell>
                  <TableCell className="text-xs font-semibold text-slate-800 whitespace-nowrap">{l.pump_machines?.name || "-"}</TableCell>
                  <TableCell className="text-xs text-right font-medium text-slate-700">{Number(l.meter_reading).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-right font-bold text-teal-600 bg-teal-50/30">{l.hours_used === null ? "-" : Number(l.hours_used).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-slate-600">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{l.recorder_name}{l.notes ? ` — ${l.notes}` : ""}</span>
                      {isAdmin && (
                        <span className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50 rounded-lg" onClick={() => openEdit(l)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded-lg" onClick={() => handleDelete(l.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base">{editId ? "แก้ไขบันทึกมิเตอร์" : "บันทึกมิเตอร์ชั่วโมงทำงาน"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">เครื่องจักร</label>
              <Select value={machineId} onValueChange={setMachineId}>
                <SelectTrigger className="h-10 text-sm bg-white"><SelectValue placeholder="เลือกเครื่อง" /></SelectTrigger>
                <SelectContent className="bg-white z-50">
                  {machines.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">วันที่</label>
                <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} disabled={!isAdmin && !!editId} className="h-10 text-sm" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">เวลา</label>
                <Input type="time" value={recordTime} onChange={(e) => setRecordTime(e.target.value)} className="h-10 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">เลขมิเตอร์ครั้งก่อน</label>
                <Input value={lastReading === null ? "-" : lastReading} readOnly className="h-10 text-sm bg-slate-100 text-slate-500" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-teal-700">เลขมิเตอร์ล่าสุด</label>
                <Input type="number" value={meterReading} onChange={(e) => setMeterReading(e.target.value)} className="h-10 text-sm font-bold" />
              </div>
            </div>
            <div className="p-3 rounded-xl bg-teal-50 border border-teal-100 text-sm font-bold text-teal-700">
              ชั่วโมงการทำงานที่ใช้: {hoursUsed === null ? "-" : `${hoursUsed.toLocaleString()} ชม.`}
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-500">หมายเหตุ</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold">
                <Save className="mr-2 h-4 w-4" /> {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
              </Button>
              <Button variant="outline" onClick={() => setOpenForm(false)} className="h-11 rounded-xl">ยกเลิก</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
