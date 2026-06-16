import { useState, useMemo, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Trash2, Wrench, Flame, ShieldAlert, CheckCircle } from "lucide-react";
import * as XLSX from "xlsx"; // เรียกใช้โดยตรงเพื่อไม่ให้พังเรื่อง exportToExcel

interface Location {
  id: string;
  name: string;
}

export default function FireCheck() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [openLocationSelect, setOpenLocationSelect] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scannedLocationName, setScannedLocationName] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), "yyyy-MM"));

  // ข้อมูลสายน้ำดับเพลิง 8 จุด (เพิ่มเข้าไปตามที่สั่ง)
  const fireHosePoints = [
    { id: 1, location: "ข้างห้องเวชกรรมฟื้นฟู", qty: 1 },
    { id: 2, location: "กลุ่มการพยาบาล (อาคารศรีศิริฯ)", qty: 1 },
    { id: 3, location: "ข้างอาคารแพทย์แผนไทย", qty: 1 },
    { id: 4, location: "อาคารคลังยา", qty: 1 },
    { id: 5, location: "ตึกผู้ป่วยในชาย", qty: 1 },
    { id: 6, location: "ตึกผู้ป่วยในหญิง", qty: 1 },
    { id: 7, location: "คลินิกพิเศษ เบอร์ 27", qty: 1 },
    { id: 8, location: "ห้องเก็บเงิน 88", qty: 1 }
  ];

  const [formData, setFormData] = useState({
    pressure_gauge: true,
    safety_pin: true,
    hose_condition: true,
    body_condition: true,
    accessible: true,
    notes: "",
  });

  const [issueDialog, setIssueDialog] = useState<{
    label: string;
    desc: string;
    check: any;
  } | null>(null);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ["fire-locations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fire_check_locations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: checks = [], refetch: refetchChecks } = useQuery({
    queryKey: ["fire-checks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fire_checks")
        .select(`
          *,
          fire_check_locations (name),
          profiles:created_by (full_name),
          departments (name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const today = startOfDay(new Date());
    const week = startOfWeek(new Date(), { weekStartsOn: 1 });
    const month = startOfMonth(new Date());

    return {
      today: checks.filter((c: any) => startOfDay(new Date(c.created_at)) >= today).length,
      week: checks.filter((c: any) => startOfWeek(new Date(c.created_at), { weekStartsOn: 1 }) >= week).length,
      month: checks.filter((c: any) => startOfMonth(new Date(c.created_at)) >= month).length,
      total: checks.length,
    };
  }, [checks]);

  const filteredHistory = useMemo(() => {
    return checks.filter((c: any) => {
      const checkMonth = format(new Date(c.created_at), "yyyy-MM");
      return checkMonth === selectedMonth;
    });
  }, [checks, selectedMonth]);

  const createCheckMutation = useMutation({
    mutationFn: async (locationId: string) => {
      const { error } = await supabase.from("fire_checks").insert({
        location_id: locationId,
        pressure_gauge: formData.pressure_gauge,
        safety_pin: formData.safety_pin,
        hose_condition: formData.hose_condition,
        body_condition: formData.body_condition,
        accessible: formData.accessible,
        notes: formData.notes,
        created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกผลการตรวจเช็คสำเร็จ");
      setSelectedLocation("");
      setScanResult(null);
      setScannedLocationName(null);
      setFormData({
        pressure_gauge: true,
        safety_pin: true,
        hose_condition: true,
        body_condition: true,
        accessible: true,
        notes: "",
      });
      refetchChecks();
    },
    onError: (error: any) => {
      toast.error("เกิดข้อผิดพลาด: " + error.message);
    },
  });

  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (isScanning) {
      scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      );
      scanner.render(
        async (result) => {
          setScanResult(result);
          setIsScanning(false);
          if (scanner) scanner.clear();

          try {
            const { data, error } = await supabase
              .from("fire_check_locations")
              .select("id, name")
              .eq("id", result)
              .maybeSingle();

            if (error) throw error;
            if (data) {
              setSelectedLocation(data.id);
              setScannedLocationName(data.name);
              toast.success(`พบตำแหน่ง: ${data.name}`);
            } else {
              toast.error("ไม่พบข้อมูลตำแหน่งนี้ในระบบถังดับเพลิง");
            }
          } catch (err: any) {
            toast.error("เกิดข้อผิดพลาดในการดึงข้อมูล: " + err.message);
          }
        },
        (error) => {
          console.warn(error);
        }
      );
    }
    return () => {
      if (scanner) {
        scanner.clear().catch((err) => console.error("Failed to clear scanner", err));
      }
    };
  }, [isScanning]);

  const handleExport = () => {
    if (filteredHistory.length === 0) {
      toast.error("ไม่มีข้อมูลในเดือนที่เลือก");
      return;
    }
    const exportData = filteredHistory.map((c: any) => ({
      "วัน-เวลาที่ตรวจ": format(new Date(c.created_at), "dd/MM/yyyy HH:mm", { locale: th }),
      "สถานที่ / ตำแหน่ง": c.fire_check_locations?.name || "ไม่ระบุ",
      "เกจวัดความดัน": c.pressure_gauge ? "ปกติ" : "ผิดปกติ",
      "สลักนิรภัย": c.safety_pin ? "ปกติ" : "ผิดปกติ",
      "สภาพสายฉีด": c.hose_condition ? "ปกติ" : "ผิดปกติ",
      "สภาพตัวถัง": c.body_condition ? "ปกติ" : "ผิดปกติ",
      "สิ่งกีดขวาง": c.accessible ? "ไม่มี" : "มีสิ่งกีดขวาง",
      "หมายเหตุ / บันทึกเพิ่มเติม": c.notes || "-",
      "ผู้ตรวจเช็ค": c.profiles?.full_name || "ไม่ระบุผู้ตรวจ",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Fire Check Report");
    XLSX.writeFile(workbook, `รายงานการตรวจเช็คถังดับเพลิง_${selectedMonth}.xlsx`);
    toast.success("ดาวน์โหลดรายงาน Excel สำเร็จ");
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ตรวจเช็คถังดับเพลิง (Fire Check)</h1>
        <p className="text-slate-500">บันทึกรายงานสถานะความปลอดภัยและการตรวจเช็คถังดับเพลิงรายจุด</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-3xl shadow-sm border-slate-100/80">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-400">วันนี้</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{stats.today}</span>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm border-slate-100/80">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-400">สัปดาห์นี้</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{stats.week}</span>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm border-slate-100/80">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-400">เดือนนี้</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{stats.month}</span>
          </CardContent>
        </Card>
        <Card className="rounded-3xl shadow-sm border-slate-100/80">
          <CardContent className="p-4 flex flex-col items-center justify-center text-center">
            <span className="text-xs font-semibold text-slate-400">ทั้งหมด</span>
            <span className="text-2xl font-bold text-slate-800 mt-1">{stats.total}</span>
          </CardContent>
        </Card>
      </div>

      {/* ================= เริ่มส่วนที่เพิ่มเข้ามาโดยห้ามเปลี่ยนโครงสร้างเดิม ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* สรุปข้อมูลถังดับเพลิง */}
        <Card className="shadow-sm border border-slate-200/80 bg-white rounded-3xl overflow-hidden md:col-span-1">
          <CardHeader className="bg-rose-50/50 border-b border-slate-100 py-3 px-4">
            <CardTitle className="text-xs sm:text-sm font-bold text-rose-800 flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-600" /> สรุปข้อมูลถังดับเพลิงทั้งหมด
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="text-center bg-rose-50/30 py-2.5 rounded-xl border border-rose-100/50">
              <span className="text-[10px] font-semibold text-slate-500 block">จำนวนถังรวม</span>
              <span className="text-2xl font-black text-rose-600">87</span>
              <span className="text-xs text-slate-500 font-medium ml-1">ถัง</span>
            </div>
            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
                  <span className="text-slate-600 font-medium">สีแดง</span>
                </div>
                <span className="font-bold text-red-700">47 ถัง</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  <span className="text-slate-600 font-medium">สีเขียว</span>
                </div>
                <span className="font-bold text-emerald-700">39 ถัง</span>
              </div>
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block"></span>
                  <span className="text-slate-600 font-medium">สีบรอนซ์</span>
                </div>
                <span className="font-bold text-slate-700">1 ถัง</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* รายละเอียดระบบสายน้ำดับเพลิง */}
        <Card className="shadow-sm border border-slate-200/80 bg-white rounded-3xl overflow-hidden md:col-span-2">
          <CardHeader className="bg-blue-50/50 border-b border-slate-100 py-3 px-4 flex flex-row justify-between items-center">
            <CardTitle className="text-xs sm:text-sm font-bold text-blue-800 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-blue-600" /> รายละเอียดระบบสายน้ำดับเพลิง
            </CardTitle>
            <span className="text-[10px] bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">
              สายยาว 20 เมตร
            </span>
          </CardHeader>
          <CardContent className="p-3">
            <div className="mb-2 text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> จุดติดตั้งในอาคารทั้งหมด <span className="text-blue-600 font-bold">8 จุด</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[145px] overflow-y-auto pr-1">
              {fireHosePoints.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-1.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="flex items-center justify-center w-4 h-4 rounded bg-blue-50 text-blue-600 font-bold text-[9px] border border-blue-100 shrink-0">
                      {item.id}
                    </span>
                    <span className="text-slate-700 font-medium truncate">{item.location}</span>
                  </div>
                  <span className="font-bold text-slate-500 shrink-0 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {item.qty} จุด
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      {/* ================= สิ้นสุดส่วนที่เพิ่มเข้ามา ================= */}

      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={() => setIsScanning(!isScanning)}
          className={cn(
            "flex-1 h-14 rounded-2xl font-bold text-base shadow-md transition-all active:scale-95",
            isScanning
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
        >
          {isScanning ? "ปิดกล้องสแกน" : "สแกน QR Code ตรวจเช็ค"}
        </Button>
        <Button
          onClick={() => setIsHistoryOpen(true)}
          className="sm:w-48 h-14 rounded-2xl font-bold text-base shadow-sm border-slate-200"
          variant="outline"
        >
          ดูประวัติย้อนหลัง
        </Button>
      </div>

      {isScanning && (
        <Card className="rounded-3xl border-2 border-dashed border-primary/30 overflow-hidden bg-slate-950 shadow-inner">
          <CardContent className="p-4 flex flex-col items-center justify-center">
            <div id="reader" className="w-full max-w-[350px] bg-black rounded-2xl overflow-hidden" />
            <p className="text-sm text-slate-400 mt-3 font-medium animate-pulse">
              ส่องกล้องไปที่คิวอาร์โค้ดของถังดับเพลิง
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-3xl shadow-md border-slate-100/80 bg-white">
        <CardHeader className="border-b border-slate-50 px-6 py-5">
          <CardTitle className="text-lg font-bold text-slate-800">
            {scannedLocationName
              ? `ฟอร์มตรวจบันทึก: ${scannedLocationName}`
              : "บันทึกข้อมูลผลการตรวจสอบ"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">
              เลือกสถานที่ / ตำแหน่งถังดับเพลิง (กรณีไม่ได้สแกน)
            </Label>
            <Popover open={openLocationSelect} onOpenChange={setOpenLocationSelect}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={openLocationSelect}
                  className="w-full h-12 justify-between rounded-2xl text-left font-normal border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                >
                  {selectedLocation
                    ? locations.find((l) => l.id === selectedLocation)?.name
                    : "ค้นหาหรือเลือกสถานที่..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[var(--radix-popover-trigger-width)] p-0 rounded-2xl overflow-hidden"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="พิมพ์ค้นหาสถานที่..." className="h-11" />
                  <CommandList>
                    <CommandEmpty>ไม่พบข้อมูลสถานที่</CommandEmpty>
                    <CommandGroup>
                      {locations.map((loc) => (
                        <CommandItem
                          key={loc.id}
                          value={loc.name}
                          onSelect={() => {
                            setSelectedLocation(loc.id);
                            setScannedLocationName(loc.name);
                            setOpenLocationSelect(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLocation === loc.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {loc.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100/80 transition-all hover:bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-slate-800">
                  1. เกจวัดความดัน (Pressure Gauge)
                </Label>
                <p className="text-xs text-slate-400">เข็มวัดต้องชี้อยู่ในช่องสีเขียว</p>
              </div>
              <Switch
                checked={formData.pressure_gauge}
                onCheckedChange={(v) => setFormData({ ...formData, pressure_gauge: v })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100/80 transition-all hover:bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-slate-800">
                  2. สลักนิรภัยและซีลล็อก (Safety Pin)
                </Label>
                <p className="text-xs text-slate-400">สลักและซีลต้องล็อกแน่นหนา ไม่หลุดขาด</p>
              </div>
              <Switch
                checked={formData.safety_pin}
                onCheckedChange={(v) => setFormData({ ...formData, safety_pin: v })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100/80 transition-all hover:bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-slate-800">
                  3. สภาพสายฉีด (Hose Condition)
                </Label>
                <p className="text-xs text-slate-400">สายฉีดไม่แตก หักอุดตัน หรือกรอบแห้ง</p>
              </div>
              <Switch
                checked={formData.hose_condition}
                onCheckedChange={(v) => setFormData({ ...formData, hose_condition: v })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100/80 transition-all hover:bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-slate-800">
                  4. สภาพตัวถัง (Body Condition)
                </Label>
                <p className="text-xs text-slate-400">ตัวถังไม่เป็นสนิม ไม่บวม บุบ หรือชำรุด</p>
              </div>
              <Switch
                checked={formData.body_condition}
                onCheckedChange={(v) => setFormData({ ...formData, body_condition: v })}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50/60 border border-slate-100/80 transition-all hover:bg-slate-50">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold text-slate-800">
                  5. บริเวณที่ติดตั้ง (Accessibility)
                </Label>
                <p className="text-xs text-slate-400">หยิบใช้งานสะดวก ไม่มีสิ่งกีดขวางทางเข้าออก</p>
              </div>
              <Switch
                checked={formData.accessible}
                onCheckedChange={(v) => setFormData({ ...formData, accessible: v })}
              />
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <Label className="text-sm font-semibold text-slate-700">
              บันทึกเพิ่มเติม / ระบุอาการผิดปกติ (ถ้ามี)
            </Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="ระบุข้อมูลเพิ่มเติมเกี่ยวกับสภาพถังดับเพลิง..."
              rows={3}
              className="rounded-2xl border-slate-200 focus:ring-primary bg-slate-50/30"
            />
          </div>

          <Button
            className="w-full h-12 rounded-2xl font-bold text-base shadow-md transition-all active:scale-[0.99] mt-2"
            disabled={!selectedLocation || createCheckMutation.isPending}
            onClick={() => createCheckMutation.mutate(selectedLocation)}
          >
            {createCheckMutation.isPending ? "กำลังบันทึกข้อมูล..." : "บันทึกผลการตรวจสอบ"}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 pr-6">
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900">
                ประวัติการตรวจเช็คถังดับเพลิง
              </DialogTitle>
              <p className="text-xs text-slate-400 mt-1">แสดงประวัติย้อนหลังเรียงตามเดือนที่กำหนด</p>
            </div>
          </DialogHeader>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 my-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-bold text-slate-500 whitespace-nowrap">
                เลือกเดือนที่ต้องการดู:
              </Label>
              {/* เปลี่ยนเป็น Input ธรรมดาเพื่อความปลอดภัยในการคอมไพล์ */}
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex h-10 rounded-xl bg-white border border-slate-200 text-sm font-medium w-44 px-3 py-2"
              />
            </div>
            <Button
              onClick={handleExport}
              className="h-10 rounded-xl font-semibold text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              disabled={filteredHistory.length === 0}
            >
              <Download className="mr-2 h-4 w-4" /> ส่งออกไฟล์รายงาน (Excel)
            </Button>
          </div>

          <div className="border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                    <th className="p-3.5 whitespace-nowrap">วัน-เวลาที่ตรวจ</th>
                    <th className="p-3.5">สถานที่</th>
                    <th className="p-3.5 text-center whitespace-nowrap">เกจวัด</th>
                    <th className="p-3.5 text-center whitespace-nowrap">สลัก</th>
                    <th className="p-3.5 text-center whitespace-nowrap">สายฉีด</th>
                    <th className="p-3.5 text-center whitespace-nowrap">ตัวถัง</th>
                    <th className="p-3.5 text-center whitespace-nowrap">การเข้าถึง</th>
                    <th className="p-3.5">ผู้ตรวจเช็ค</th>
                    <th className="p-3.5 text-center">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-slate-700">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-10 text-slate-400 font-medium bg-white">
                        ไม่มีบันทึกข้อมูลการตรวจสอบในเดือนนี้
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((check: any) => {
                      const hasIssue =
                        !check.pressure_gauge ||
                        !check.safety_pin ||
                        !check.hose_condition ||
                        !check.body_condition ||
                        !check.accessible;
                      return (
                        <tr
                          key={check.id}
                          className={cn(
                            "hover:bg-slate-50/50 transition-colors bg-white",
                            hasIssue && "bg-rose-50/20"
                          )}
                        >
                          <td className="p-3.5 font-medium whitespace-nowrap">
                            {format(new Date(check.created_at), "dd/MM/yyyy HH:mm", { locale: th })}
                          </td>
                          <td className="p-3.5 font-semibold text-slate-900">
                            {check.fire_check_locations?.name || "ไม่ทราบสถานที่"}
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={check.pressure_gauge ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 font-bold rounded-md"
                            >
                              {check.pressure_gauge ? "ปกติ" : "ผิดปกติ"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={check.safety_pin ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 font-bold rounded-md"
                            >
                              {check.safety_pin ? "ปกติ" : "ผิดปกติ"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={check.hose_condition ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 font-bold rounded-md"
                            >
                              {check.hose_condition ? "ปกติ" : "ผิดปกติ"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={check.body_condition ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 font-bold rounded-md"
                            >
                              {check.body_condition ? "ปกติ" : "ผิดปกติ"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-center">
                            <Badge
                              variant={check.accessible ? "secondary" : "destructive"}
                              className="text-[10px] px-1.5 font-bold rounded-md"
                            >
                              {check.accessible ? "ปกติ" : "มีสิ่งกีดขวาง"}
                            </Badge>
                          </td>
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {check.profiles?.full_name || "ไม่ระบุ"}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              {hasIssue && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-[10px] font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200 rounded-lg flex items-center gap-1"
                                  onClick={() => {
                                    let desc = "";
                                    if (!check.pressure_gauge) desc += "- เกจวัดความดันผิดปกติ\n";
                                    if (!check.safety_pin) desc += "- สลักนิรภัยชำรุด/ขาด\n";
                                    if (!check.hose_condition) desc += "- สภาพสายฉีดชำรุด\n";
                                    if (!check.body_condition) desc += "- ตัวถังมีสนิม/ชำรุด\n";
                                    if (!check.accessible) desc += "- มีสิ่งกีดขวางจุดติดตั้ง\n";
                                    setIssueDialog({
                                      label: check.fire_check_locations?.name || "ไม่ระบุ",
                                      desc,
                                      check,
                                    });
                                    setIssueNotes("");
                                  }}
                                >
                                  <Wrench className="h-3 w-3" /> ซ่อมแซม
                                </Button>
                              )}
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-lg text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                onClick={async () => {
                                  if (confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการบันทึกนี้?")) {
                                    const { error } = await supabase
                                      .from("fire_checks")
                                      .delete()
                                      .eq("id", check.id);
                                    if (error) {
                                      toast.error(error.message);
                                      return;
                                    }
                                    toast.success("ลบบันทึกประวัติสำเร็จ");
                                    refetchChecks();
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issueDialog} onOpenChange={(o) => !o && setIssueDialog(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              บันทึกการแก้ไขปัญหาถังดับเพลิง
            </DialogTitle>
          </DialogHeader>
          {issueDialog && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-rose-50 border border-rose-100 rounded-2xl text-xs space-y-1">
                <p className="font-bold text-rose-800">ตำแหน่ง: {issueDialog.label}</p>
                <p className="text-rose-700 whitespace-pre-line font-medium leading-relaxed">
                  {issueDialog.desc}
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">
                  บันทึกผลการดำเนินการแก้ไข / วิธีซ่อมแซม
                </Label>
                <Textarea
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="ระบุวิธีการแก้ไขปัญหา..."
                  rows={3}
                  className="rounded-2xl mt-1"
                />
              </div>
              <Button
                className="w-full h-12 rounded-2xl font-bold"
                disabled={!issueNotes.trim() || issueSaving}
                onClick={async () => {
                  setIssueSaving(true);
                  const chk = issueDialog.check;
                  const { error } = await supabase.from("issues").insert({
                    title: `[ถังดับเพลิง] ${issueDialog.label} ผิดปกติ`,
                    description: `ตำแหน่ง: ${chk?.location_name || chk?.location || "-"}\n${
                      issueDialog.desc
                    }`,
                    source_module: "fire_check",
                    source_id: chk?.id,
                    severity: "high",
                    status: "resolved",
                    resolution_notes: issueNotes,
                    department_name: chk?.departments?.name || null,
                    created_by: user?.id,
                    resolved_at: new Date().toISOString(),
                    resolved_by: user?.id,
                  });
                  setIssueSaving(false);
                  if (error) {
                    toast.error(error.message);
                    return;
                  }
                  toast.success("บันทึกการจัดการปัญหาสำเร็จ");
                  setIssueDialog(null);
                  queryClient.invalidateQueries({ queryKey: ["issues"] });
                }}
              >
                {issueSaving ? "กำลังบันทึก..." : "บันทึกการจัดการปัญหา"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
