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
import { Check, ChevronsUpDown, Download, Trash2, Flame, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle, XCircle } from "lucide-react";
import { Wrench } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { createAutoIssue, getIssueSeverity, hasFireCheckAnomaly } from "@/lib/createAutoIssue";
import PageHeader from "@/components/PageHeader";

interface InspectionDetails {
  body_ok: boolean; hose_ok: boolean; handle_ok: boolean;
  gauge_green: boolean; safety_pin_ok: boolean; tamper_seal_ok: boolean;
}

const defaultInspection: InspectionDetails = {
  body_ok: true, hose_ok: true, handle_ok: true,
  gauge_green: true, safety_pin_ok: true, tamper_seal_ok: true,
};

const inspectionItems: { key: keyof InspectionDetails; group: string; label: string; desc: string }[] = [
  { key: "body_ok", group: "สภาพภายนอก", label: "ตัวถัง", desc: "ไม่บุบ ไม่เป็นสนิม ไม่มีรอยกัดกร่อน" },
  { key: "hose_ok", group: "สภาพภายนอก", label: "สายฉีด (Hose)", desc: "ไม่แตกกรอบ ไม่หักงอ ไม่มีสิ่งอุดตัน" },
  { key: "handle_ok", group: "สภาพภายนอก", label: "คันบีบและไกกด", desc: "สภาพสมบูรณ์ ไม่คดงอหรือฝืด" },
  { key: "gauge_green", group: "มาตรวัดความดัน", label: "เข็มวัดอยู่ในแถบสีเขียว", desc: "ซ้าย = แรงดันตก / ขวา = แรงดันเกิน" },
  { key: "safety_pin_ok", group: "อุปกรณ์นิรภัย", label: "สลักนิรภัย (Safety Pin)", desc: "เสียบอยู่คาที่" },
  { key: "tamper_seal_ok", group: "อุปกรณ์นิรภัย", label: "ซีลตะกั่ว/พลาสติก (Tamper Seal)", desc: "รัดสลักไว้ ไม่มีรอยขาด" },
];

const SYNC_KEY = "fire_extinguisher_last_sync";

function QrScannerSection({ onResult }: { onResult: (data: string) => void }) {
  const [showScanner, setShowScanner] = useState(false);
  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5QrcodeScanner("qr-reader-fire", { fps: 10, qrbox: { width: 250, height: 250 }, rememberLastUsedCamera: true, facingMode: "environment" } as any, false);
    scanner.render(
      (text) => { onResult(text); scanner.clear(); setShowScanner(false); },
      () => {}
    );
    return () => { try { scanner.clear(); } catch {} };
  }, [showScanner]);
  return (
    <>
      <Button variant="outline" className="w-full h-13 rounded-2xl text-base gap-2" onClick={() => setShowScanner(!showScanner)}>
        📷 {showScanner ? "ปิดกล้อง" : "สแกน QR Code ถังดับเพลิง"}
      </Button>
      {showScanner && <div id="qr-reader-fire" className="w-full rounded-2xl overflow-hidden" />}
    </>
  );
}

export default function FireCheck() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [locationId, setLocationId] = useState("");
  const [locationOpen, setLocationOpen] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<any>(null);
  
  const [inspection, setInspection] = useState<InspectionDetails>({ ...defaultInspection });
  const [notes, setNotes] = useState("");
  const [filterResult, setFilterResult] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [issueDialog, setIssueDialog] = useState<any>(null);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);

  // เพิ่ม State สำหรับจัดการการซิงค์และป๊อปอัพถังค้างตรวจ
  const [showUncheckedModal, setShowUncheckedModal] = useState(false);
  const [lastSyncText, setLastSyncText] = useState<string>("");

  // ข้อมูลจุดติดตั้งระบบสายน้ำดับเพลิง 8 จุดหลัก
  const fireHosePoints = [
    { id: 1, location: "ข้างห้องเวชกรรมฟื้นฟู", qty: 1 },
    { id: 2, location: "กลุ่มการพยาบาล (อาคารศรีศิริฯ)", qty: 1 },
    { id: 3, location: "ข้างอาคารแพทย์แผนไทย", qty: 1 },
    { id: 4, location: "อาคารคลังยา", qty: 1 },
    { id: 5, location: "ตึกผู้ป่วยในชาย",
