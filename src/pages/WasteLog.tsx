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
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

// กำหนด Interface เพื่อระบุ Type ให้ถูกต้องสำหรับแถวข้อมูลขยะติดเชื้อ ป้องกัน Build Failed
interface InfectiousRow {
  id?: string;
  health_center_name: string;
  sharp_waste_kg: string;
  non_sharp_waste_kg: string;
  delivered_by: string;
  source_type: string;
  bottle_count: string;
}

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "#4C6085" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "#36F1CD" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "#F38181" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "#E2AF90" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "#4C6085" },
};

const WASTE_TYPE_LABELS: Record<string, string> = {
  general: "ขยะทั่วไป",
  infectious: "ขยะติดเชื้อ",
  recycle: "ขยะรีไซเคิล",
  recyclable: "ขยะรีไซเคิล",
  hazardous: "ขยะอันตราย",
  organic: "ขยะเปียก",
  "organic waste": "ขยะเปียก",
  other: "อื่นๆ",
};

const FALLBACK_CHART_COLORS = ["#4C6085", "#36F1CD", "#F38181", "#E2AF90", "#4C6085"];

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>(DEFAULT_WASTE_TYPES);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [wasteType, setWasteType] = useState("general");
  const [weight, setWeight] =
