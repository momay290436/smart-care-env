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
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "#057971" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "#c50915" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "#007bc1" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "#7627ff" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "#008932" },
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

const PIE_COLORS = ["#057971", "#008932", "#ec407a", "#7627ff", "#007bc1"];
const CHART_COLORS = ["#057971", "#008932", "#ec407a", "#7627ff", "#007bc1"];

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>(DEFAULT_WASTE_TYPES);
  const [manageDeptsOpen, setManageDeptsOpen] = useState(false);
  const [deptEditName, setDeptEditName] = useState("");
  const [deptEditId, setDeptEditId] = useState<string | null>(null);
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [wasteType, setWasteType] = useState("general");
  const [weight, setWeight] = useState("");
  const [selectedDept, setSelectedDept] = useState(profile?.department_id || "");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [costPerKg, setCostPerKg] = useState<Record<string, number>>({ general: 2, infectious: 15, recycle: 0, hazardous: 25 });
  const [customDateTime, setCustomDateTime] = useState("");
  const [customRecorder, setCustomRecorder] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  const [chartFrom, setChartFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 6); return startOfDay(d); });
  const [chartTo, setChartTo] = useState<Date>(() => new Date());

  const HEALTH_CENTERS = [
    "โรงพยาบาลแม่สรวย","รพ.สต.โป่งปูเฟือง","รพ.สต.โป่งกลางน้ำ","รพ.สต.ทุ่งพร้าว","รพ.สต.ห้วยไคร้",
    "รพ.สต.วาวี","รพ.สต.บ้านดอยช้าง","รพ.สต.แม่สรวย","รพ.สต.เจดีย์หลวง",
    "รพ.สต.ศรีถ้อย","รพ.สต.ห้วยน้ำขุ่น","รพ.สต.ท่าก๊อ","รพ.สต.ป่าแดด","คลินิกเอกชน","ปริมาณขวด"
  ];
  const emptyInfRow = () => ({ id: undefined, health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "", source_type: "", bottle_count: "" });
  const [infCollectionDate, setInfCollectionDate] = useState<Date | undefined>(new Date());
  const [infTransferDate, setInfTransferDate] = useState<Date | undefined>();
  const [infRows, setInfRows] = useState<any[]>([emptyInfRow()]);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  useEffect(() => {
    (async () => {
      try {
        const { data: wt } = await supabase.from("app_settings").select("value").eq("key", "waste_types").maybeSingle();
        if (wt && wt.value) {
          const parsed = JSON.parse(wt.value);
          if (parsed && typeof parsed === "object") setTypesMap(parsed);
        }
        const { data: wc } = await supabase.from("app_settings").select("value").eq("key", "waste_costs").maybeSingle();
        if (wc && wc.value) {
          const parsed = JSON.parse(wc.value);
          if (parsed && typeof parsed === "object") setCostPerKg(parsed);
        }
      } catch (e) {}
    })();
  }, []);

  const { data: logs = [] } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("waste_logs")
        .select("*, departments(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: infectiousWasteRecords = [] } = useQuery({
    queryKey: ["infectious-waste"],
    queryFn: async () => {
      const { data } = await supabase
        .from("infectious_waste_records")
        .select("*")
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createLog = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");

      if (wasteType === "infectious") {
        const valid = infRows.filter((r: any) => r.health_center_name?.trim());
        if (valid.length === 0) throw new Error("กรุณากรอกชื่อหน่วยงานอย่างน้อย 1 รายการ");
        if (!infCollectionDate) throw new Error("กรุณาเลือกวันที่รับขยะ");

        if (editingLogId) {
          const { error: errDelOld } = await supabase.from("infectious_waste_records").delete().eq("collection_date", format(infCollectionDate, "yyyy-MM-dd"));
          if (errDelOld) throw errDelOld;
        }

        const inserts = valid.map((r: any) => ({
          collection_date: format(infCollectionDate, "yyyy-MM-dd"),
          transfer_date: infTransferDate ? format(infTransferDate, "yyyy-MM-dd") : null,
          health_center_name: r.health_center_name.trim(),
          sharp_waste_kg: r.sharp_waste_kg ? parseFloat(r.sharp_waste_kg) : 0,
          non_sharp_waste_kg: r.non_sharp_waste_kg ? parseFloat(r.non_sharp_waste_kg) : 0,
          delivered_by: r.delivered_by?.trim() || null,
          notes: (r.source_type || r.bottle_count) ? JSON.stringify({ source_type: r.source_type, bottle_count: r.bottle_count }) : null,
          recorded_by: user.id,
        }));
        const { error: errInf } = await supabase.from("infectious_waste_records").insert(inserts);
        if (errInf) throw errInf;

        const totalKg = inserts.reduce((s, x) => s + (x.sharp_waste_kg || 0) + (x.non_sharp_waste_kg || 0), 0);
        if (totalKg > 0) {
          const aggPayload: any = {
            waste_type: "infectious",
            weight: totalKg,
            department_id: selectedDept || profile?.department_id || null,
            recorded_by: user.id,
          };
          if (isAdmin && customDateTime) aggPayload.created_at = new Date(customDateTime).toISOString();
          else aggPayload.created_at = new Date(format(infCollectionDate, "yyyy-MM-dd") + "T08:00:00").toISOString();
          
          if (editingLogId && !editingLogId.startsWith("infectious-")) {
            const { error: errAgg } = await supabase.from("waste_logs").update(aggPayload).eq("id", editingLogId);
            if (errAgg) throw errAgg;
          } else {
            if (editingLogId && editingLogId.startsWith("infectious-")) {
              await supabase.from("waste_logs").delete().eq("id", editingLogId);
            }
            const { error: errAgg } = await supabase.from("waste_logs").insert(aggPayload);
            if (errAgg) throw errAgg;
          }
        }
        return;
      }

      const w = parseFloat(weight);
      const payload: any = {
        waste_type: wasteType,
        weight: w,
        department_id: selectedDept || profile?.department_id || null,
        recorded_by: user.id,
        recorded_by_name: (isAdmin && customRecorder.trim()) ? customRecorder.trim() : (profile?.full_name || ""),
      };
      if (isAdmin && customDateTime) {
        payload.created_at = new Date(customDateTime).toISOString();
      }

      if (editingLogId && !editingLogId.startsWith("infectious-")) {
        const { error } = await supabase.from("waste_logs").update(payload).eq("id", editingLogId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("waste_logs").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingLogId ? "แก้ไขข้อมูลสำเร็จ" : "บันทึกน้ำหนักขยะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
      setShowForm(false);
      setWeight("");
      setCustomDateTime("");
      setCustomRecorder("");
      setEditingLogId(null);
      setInfRows([emptyInfRow()]);
      setInfCollectionDate(new Date());
      setInfTransferDate(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("infectious-")) {
        const parts = id.split("|");
        if (parts.length > 0) {
          const dateStr = parts[0].replace("infectious-", "").substring(0, 10);
          const { error } = await supabase.from("infectious_waste_records").delete().eq("collection_date", dateStr);
          if (error) throw error;
        }
      }
      const { error } = await supabase.from("waste_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveDepartment = useMutation({
    mutationFn: async ({ id, name }:
