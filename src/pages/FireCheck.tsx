import { useState, useMemo, useEffect } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input"; // เพิ่มการ Import ตัวนี้เพื่อแก้ไขอาการหน้าจอขาว
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";

// รวมการ Import ของ lucide-react ไว้ที่เดียวกัน
import { Check, ChevronsUpDown, Download, Trash2, Wrench, Flame, ShieldAlert, CheckCircle } from "lucide-react";

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

  // ข้อมูลสถิติแบบคงที่สำหรับสายน้ำดับเพลิง 8 จุด
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
      scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
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
    exportToExcel(exportData, `รายงานการตรวจเช็คถังดับเพลิง_${selectedMonth}`);
    toast.success("ดาวน์โหลดรายงาน Excel สำเร็จ");
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">ตรวจเช็คถังดับเพลิง (Fire Check)</h1>
        <p className="text-slate-500">บันทึกรายงานสถานะความปลอดภัยและการตรวจเช็คถังดับเพลิงรายจุด</p>
      </div>

      {/* สถิติภาพรวมเดิม */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="rounded-3xl shadow-sm border-slate-100/80">
          <CardContent className="p-4 flex flex-col items-center
