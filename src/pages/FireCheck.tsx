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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";

// รวมการ Import ของ lucide-react ไว้ที่เดียวกันเพื่อไม่ให้หน้าจอขาว
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
    { id: 7, location: "คลินิกพิเศษ เบอร์ 27
