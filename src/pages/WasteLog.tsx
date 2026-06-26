import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectScrollUpButton, SelectScrollDownButton } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

interface WasteSettings {
  infectious_carrier_cost: number;
}

const defaultWasteSettings: WasteSettings = {
  infectious_carrier_cost: 40,
};

export default function WasteLog() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState<any>(null);
  
  const [wasteType, setWasteType] = useState("");
  const [weight, setWeight] = useState("");
  const [collectedAt, setCollectedAt] = useState<Date>(new Date());
  const [carrierName, setCarrierName] = useState("");
  const [manifestNo, setManifestNo] = useState("");
  const [cost, setCost] = useState("");
  
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<WasteSettings>({ ...defaultWasteSettings });

  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>({
    general: { label: "ขยะทั่วไป", color: "bg-blue-100 text-blue-800 border-blue-200", chartColor: "hsl(215 25% 65%)" },
    recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-100 text-emerald-800 border-emerald-200", chartColor: "hsl(145 25% 60%)" },
    infectious: { label: "ขยะติดเชื้อ", color: "bg-rose-100 text-rose-800 border-rose-200", chartColor: "hsl(355 25% 65%)" },
    hazardous: { label: "ขยะอันตราย", color: "bg-amber-100 text-amber-800 border-amber-200", chartColor: "hsl(35 25% 60%)" },
  });

  const { data: dbSettings } = useQuery({
    queryKey: ["waste-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("system_settings").select("value").eq("key", "waste_management_settings").maybeSingle();
      if (error) return null;
      return data?.value as unknown as WasteSettings | null;
    },
  });

  useEffect(() => {
    if (dbSettings) {
      setSettings(dbSettings);
    }
  }, [dbSettings]);

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("system_settings").upsert({
        key: "waste_management_settings",
        value: settings as any,
        updated_by: user?.id,
      }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าสำเร็จ");
      setSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["waste-settings"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ปรับปรุงการเรียงลำดับ: เปลี่ยนจาก "created_at" เป็น "collected_at" (วันที่รับขยะ) เพื่อให้เรียงจากใหม่ไปเก่าอย่างถูกต้อง
  const { data: logs } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .order("collected_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (editingLog) {
      setWasteType(editingLog.waste_type);
      setWeight(editingLog.weight_kg.toString());
      setCollectedAt(new Date(editingLog.collected_at));
      setCarrierName(editingLog.carrier_name || "");
      setManifestNo(editingLog.manifest_no || "");
      setCost(editingLog.cost_thb ? editingLog.cost_thb.toString() : "");
      setShowForm(true);
    } else {
      resetForm();
    }
  }, [editingLog]);

  useEffect(() => {
    if (wasteType === "infectious" && !cost && weight) {
      const w = parseFloat(weight);
      if (!isNaN(w)) {
        setCost((w * settings.infectious_carrier_cost).toFixed(2));
      }
    }
  }, [wasteType, weight, settings.infectious_carrier_cost]);

  const resetForm = () => {
    setWasteType("");
    setWeight("");
    setCollectedAt(new Date());
    setCarrierName("");
    setManifestNo("");
    setCost("");
    setEditingLog(null);
  };

  const logMutation = useMutation({
    mutationFn: async () => {
      if (!wasteType || !weight) throw new Error("กรุณากรอกข้อมูลที่จำเป็น");
      const payload = {
        waste_type: wasteType,
        weight_kg: parseFloat(weight),
        collected_at: collectedAt.toISOString(),
        carrier_name: wasteType === "infectious" ? carrierName : null,
        manifest_no: wasteType === "infectious" ? manifestNo : null,
        cost_thb: cost ? parseFloat(cost) : null,
        recorded_by: user?.id,
        department_id: profile?.department_id,
      };

      if (editingLog) {
        const { error } = await supabase.from("waste_logs").update(payload).eq("id", editingLog.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("waste_logs").insert(payload);
        if (error) throw error;
      }
