import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx"; // เปลี่ยนมานำเข้า xlsx เพื่อใช้สั่งแยกแผ่นงาน (Multi-sheets)
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";

interface WasteTypeConfig {
  label: string;
  color: string;
  chartColor: string;
}

const DEFAULT_TYPES_MAP: Record<string, WasteTypeConfig> = {
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-100 text-red-800 border-red-200", chartColor: "hsl(0 84.2% 60.2%)" },
  general: { label: "ขยะทั่วไป", color: "bg-blue-100 text-blue-800 border-blue-200", chartColor: "hsl(221.2 83.2% 53.3%)" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-green-100 text-green-800 border-green-200", chartColor: "hsl(142.1 76.2% 36.3%)" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-100 text-amber-800 border-amber-200", chartColor: "hsl(35.3 91.7% 32.9%)" },
};

export default function WasteLog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<string>("infectious");
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form states
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weight, setWeight] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [note, setNote] = useState("");

  // Settings states
  const [typesMap, setTypesMap] = useState<Record<string, WasteTypeConfig>>(DEFAULT_TYPES_MAP);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");

  // Filter states
  const [filterSource, setFilterSource] = useState("all");
  const [timeRange, setTimeRange] = useState("all");

  // Fetch settings
  const { data: settingsData } = useQuery({
    queryKey: ["wasteSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_settings")
        .select("value")
        .eq("key", "waste_types_config")
        .maybeSingle();
      if (error) throw error;
      return data?.value as Record<string, WasteTypeConfig> | null;
    }
  });

  useEffect(() => {
    if (settingsData) {
      setTypesMap(settingsData);
    }
  }, [settingsData]);

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("hospital_settings")
        .upsert({ key: "waste_types_config", value: typesMap }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าประเภทขยะสำเร็จ");
      setIsSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ["wasteSettings"] });
    },
    onError: (error) => {
      console.error(error);
      toast.error("ไม่สามารถบันทึกการตั้งค่าได้");
    }
  });

  // Fetch logs
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["wasteLogs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("waste_logs")
        .select("*")
        .order("collected_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uniqueSources = useMemo(() => {
    const sources = new Set(
