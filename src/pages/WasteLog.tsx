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

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-blue-100 text-blue-900 border-blue-200", chartColor: "#3b82f6" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "#10b981" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-100 text-red-900 border-red-200", chartColor: "#ef4444" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-yellow-100 text-yellow-900 border-yellow-200", chartColor: "#eab308" },
  hazardous: { label: "ขยะอันตราย", color: "bg-purple-100 text-purple-900 border-purple-200", chartColor: "#a855f7" },
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

// ย้าย Fallback Color สำหรับกรณีดึงค่าคีย์แปลกปลอมมาแสดงผล
const FALLBACK_CHART_COLORS = ["#3b82f6", "#10b981", "#ef4444", "#eab308", "#a855f7"];

// สีมาตรฐานตามข้อกำหนด ใช้บังคับให้ทุก chart/badge สอดคล้องกัน แม้ค่าจากฐานข้อมูลจะเป็นค่าเก่า
const CANONICAL_COLORS: Record<string, { color: string; chartColor: string }> = {
  general: { color: "bg-blue-100 text-blue-900 border-blue-200", chartColor: "#3b82f6" },
  organic: { color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "#10b981" },
  infectious: { color: "bg-red-100 text-red-900 border-red-200", chartColor: "#ef4444" },
  recycle: { color: "bg-yellow-100 text-yellow-900 border-yellow-200", chartColor: "#eab308" },
  hazardous: { color: "bg-purple-100 text-purple-900 border-purple-200", chartColor: "#a855f7" },
};

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
          if (parsed && typeof parsed === "object") {
            // บังคับใช้สีมาตรฐาน แม้ค่าจากฐานข้อมูลจะเป็นสีเก่า
            const merged: any = { ...parsed };
            Object.keys(CANONICAL_COLORS).forEach((k) => {
              merged[k] = { ...(parsed[k] || DEFAULT_WASTE_TYPES[k]), ...CANONICAL_COLORS[k] };
            });
            setTypesMap(merged);
          }
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
    mutationFn: async ({ id, name }: { id?: string | null; name: string }) => {
      if (!name.trim()) throw new Error("กรุณาระบุชื่อแผนก");
      if (id) {
        const { error } = await supabase.from("departments").update({ name: name.trim() }).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("departments").insert({ name: name.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("บันทึกแผนกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      setDeptEditId(null);
      setDeptEditName("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteDepartment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบแผนกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveWasteSettings = useMutation({
    mutationFn: async () => {
      const typeValue = JSON.stringify(typesMap);
      const costValue = JSON.stringify(costPerKg);

      const { data: existingTypes } = await supabase.from("app_settings").select("id").eq("key", "waste_types").maybeSingle();
      if (existingTypes) {
        await supabase.from("app_settings").update({ value: typeValue }).eq("key", "waste_types");
      } else {
        await supabase.from("app_settings").insert({ key: "waste_types", value: typeValue });
      }

      const { data: existingCosts } = await supabase.from("app_settings").select("id").eq("key", "waste_costs").maybeSingle();
      if (existingCosts) {
        await supabase.from("app_settings").update({ value: costValue }).eq("key", "waste_costs");
      } else {
        await supabase.from("app_settings").insert({ key: "waste_costs", value: costValue });
      }
    },
    onSuccess: () => {
      toast.success("บันทึกการตั้งค่าเรียบร้อยแล้ว");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const normalizeWasteType = (type: string) => {
    const key = String(type || "").trim().toLowerCase();
    if (key === "recyclable") return "recycle";
    if (key === "organic waste" || key === "organic" || key === "ขยะเปียก") return "organic";
    if (key === "general waste" || key === "ขยะทั่วไป") return "general";
    if (key === "ขยะรีไซเคิล") return "recycle";
    if (key === "ขยะติดเชื้อ") return "infectious";
    if (key === "ขยะอันตราย") return "hazardous";
    return key || "other";
  };

  const getWasteTypeLabel = (rawType: string) => {
    const normalized = normalizeWasteType(rawType);
    return WASTE_TYPE_LABELS[normalized] || typesMap[normalized]?.label || rawType;
  };

  const getWasteTypeMeta = (rawType: string) => {
    const normalized = normalizeWasteType(rawType);
    return typesMap[rawType] || typesMap[normalized] || typesMap.general;
  };

  const getWasteTypeLabelByKey = (key: string) => {
    const normalized = normalizeWasteType(key);
    if (key === "all") return "ทุกประเภท";
    return typesMap[key]?.label || typesMap[normalized]?.label || key;
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (filterType !== "all" && normalizeWasteType(log.waste_type) !== normalizeWasteType(filterType)) return false;
      const created = new Date(log.created_at);
      const now = new Date();
      if (filterPeriod === "day" && created < startOfDay(now)) return false;
      if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
      if (filterPeriod === "month" && created < startOfMonth(now)) return false;
      if (filterPeriod === "custom" && customFrom && customTo) {
        if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
      }
      return true;
    });
  }, [logs, filterType, filterPeriod, customFrom, customTo]);

  const filteredInfectious = useMemo(() => {
    const recs = infectiousWasteRecords as any[];
    if (filterPeriod === "all" && !customFrom && !customTo) return recs;
    const now = new Date();
    let from: Date | null = null;
    let to: Date | null = null;
    if (filterPeriod === "day") from = startOfDay(now);
    else if (filterPeriod === "week") from = startOfWeek(now, { weekStartsOn: 1 });
    else if (filterPeriod === "month") from = startOfMonth(now);
    else if (filterPeriod === "custom" && customFrom && customTo) { from = startOfDay(customFrom); to = new Date(startOfDay(customTo).getTime() + 86400000 - 1); }
    return recs.filter((r) => {
      const dStr = r.collection_date || r.transfer_date || r.created_at;
      if (!dStr) return true;
      const d = new Date(dStr);
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    });
  }, [infectiousWasteRecords, filterPeriod, customFrom, customTo]);

  const infectiousFilteredTotal = useMemo(() => {
    return filteredInfectious.reduce((s, r: any) => s + (Number(r.sharp_waste_kg) || 0) + (Number(r.non_sharp_waste_kg) || 0), 0);
  }, [filteredInfectious]);

 const combinedLogs = useMemo(() => {
    const normalizedFilter = normalizeWasteType(filterType);
    const baseLogs = [...filteredLogs];

    if (normalizedFilter !== "infectious" && normalizedFilter !== "all" && filterType !== "all") {
      return baseLogs;
    }

    const existingInfectious = new Set(
      baseLogs
        .filter((log: any) => normalizeWasteType(log.waste_type) === "infectious")
        .map((log: any) => {
          const dateStr = log.created_at ? log.created_at.substring(0, 10) : "";
          const weight = Math.round(Number(log.weight || 0) * 100) / 100;
          return `${dateStr}|${weight}`;
        })
    );

    filteredInfectious.forEach((record: any) => {
      const weight = Math.round((Number(record.sharp_waste_kg || 0) + Number(record.non_sharp_waste_kg || 0)) * 100) / 100;
      const dateStr = record.collection_date
        ? record.collection_date.substring(0, 10)
        : (record.created_at || record.transfer_date || new Date().toISOString()).substring(0, 10);

      const key = `${dateStr}|${weight}`;
      if (!existingInfectious.has(key)) {
        baseLogs.push({
          id: `infectious-${dateStr}|${weight}`,
          waste_type: "infectious",
          weight,
          created_at: `${dateStr}T08:00:00`,
          department_id: "",
          recorded_by: "",
          recorded_by_name: "",
          departments: { name: "" },
        } as any);
        existingInfectious.add(key);
      }
    });

    return baseLogs;
  }, [filteredLogs, filterType, filteredInfectious]);
  const chartRange = useMemo(() => {
    const now = new Date();
    if (filterPeriod === "day") return { rangeStart: startOfDay(now).getTime(), rangeEnd: now.getTime() };
    if (filterPeriod === "week") return { rangeStart: startOfWeek(now, { weekStartsOn: 1 }).getTime(), rangeEnd: now.getTime() };
    if (filterPeriod === "month") return { rangeStart: startOfMonth(now).getTime(), rangeEnd: now.getTime() };
    if (filterPeriod === "custom" && customFrom && customTo) {
      return { rangeStart: startOfDay(customFrom).getTime(), rangeEnd: new Date(startOfDay(customTo).getTime() + 86400000 - 1).getTime() };
    }
    return { rangeStart: startOfDay(chartFrom).getTime(), rangeEnd: startOfDay(chartTo).getTime() + 86400000 - 1 };
  }, [filterPeriod, customFrom, customTo, chartFrom, chartTo]);

  const combinedTypeTotals = useMemo(() => {
    return combinedLogs.reduce((acc: Record<string, number>, log: any) => {
      const normalized = normalizeWasteType(log.waste_type);
      acc[normalized] = (acc[normalized] || 0) + Number(log.weight);
      return acc;
    }, {} as Record<string, number>);
  }, [combinedLogs]);

  const handleEditLog = (log: any) => {
    setEditingLogId(log.id);
    const normalizedType = normalizeWasteType(log.waste_type);
    setWasteType(normalizedType);
    setSelectedDept(log.department_id || "");
    
    if (normalizedType === "infectious") {
      const logDateStr = log.created_at ? log.created_at.substring(0, 10) : "";
      const matches = (infectiousWasteRecords as any[]).filter(
        (r) => r.collection_date === logDateStr || (r.created_at && r.created_at.substring(0, 10) === logDateStr)
      );
      if (matches.length > 0) {
        setInfCollectionDate(matches[0].collection_date ? new Date(matches[0].collection_date) : new Date(matches[0].created_at));
        setInfTransferDate(matches[0].transfer_date ? new Date(matches[0].transfer_date) : undefined);
        setInfRows(matches.map(r => {
          let extra: any = {};
          if (r.notes) {
            try { extra = JSON.parse(r.notes); } catch(e){}
          }
          return {
            id: r.id,
            health_center_name: r.health_center_name,
            sharp_waste_kg: r.sharp_waste_kg?.toString() || "",
            non_sharp_waste_kg: r.non_sharp_waste_kg?.toString() || "",
            delivered_by: r.delivered_by || "",
            source_type: extra.source_type || "",
            bottle_count: extra.bottle_count || ""
          };
        }));
      } else {
        setInfCollectionDate(new Date(log.created_at));
        setInfRows([{ ...emptyInfRow(), sharp_waste_kg: log.weight?.toString() }]);
      }
    } else {
      setWeight(log.weight?.toString() || "");
    }

    if (log.created_at) {
      const d = new Date(log.created_at);
      const tzoffset = d.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(d.getTime() - tzoffset)).toISOString().slice(0, 16);
      setCustomDateTime(localISOTime);
    }
    setCustomRecorder(log.recorded_by_name || "");
    setShowForm(true);
  };

  const handleEditInfectiousDirect = (collectionDate: string) => {
    if (!collectionDate) return;
    const matches = (infectiousWasteRecords as any[]).filter(
      (r) => r.collection_date === collectionDate || (r.created_at && r.created_at.substring(0, 10) === collectionDate)
    );
    
    if (matches.length > 0) {
      const sampleRecord = matches[0];
      const totalWeight = matches.reduce((s, r) => s + (Number(r.sharp_waste_kg) || 0) + (Number(r.non_sharp_waste_kg) || 0), 0);
      
      const pseudoLog = {
        id: `infectious-${sampleRecord.collection_date ? new Date(sampleRecord.collection_date).toISOString() : new Date(sampleRecord.created_at).toISOString()}|${totalWeight}`,
        waste_type: "infectious",
        weight: totalWeight,
        created_at: sampleRecord.collection_date ? `${sampleRecord.collection_date}T08:00:00` : sampleRecord.created_at,
        department_id: "",
        recorded_by_name: "",
      };
      handleEditLog(pseudoLog);
    }
  };

  const chartData = useMemo(() => {
    const dayMap: Record<string, { sortKey: string; label: string; types: Record<string, number> }> = {};
    const typeMap: Record<string, number> = {};
    const deptMap: Record<string, Record<string, number>> = {};
    const allTypes = new Set<string>();

    const { rangeStart, rangeEnd } = chartRange;
    const logsInRange = combinedLogs.filter((l: any) => {
      const t = new Date(l.created_at).getTime();
      return t >= rangeStart && t <= rangeEnd;
    });
    logsInRange.forEach((log: any) => {
      const d = new Date(log.created_at);
      const sortKey = format(d, "yyyy-MM-dd");
      const label = format(d, "d MMM", { locale: th });
      const normalized = normalizeWasteType(log.waste_type);
      const wt = getWasteTypeLabel(normalized);
      const dept = log.departments?.name || "ไม่ระบุ";
      const w = Number(log.weight);

      if (!dayMap[sortKey]) dayMap[sortKey] = { sortKey, label, types: {} };
      dayMap[sortKey].types[wt] = (dayMap[sortKey].types[wt] || 0) + w;

      typeMap[wt] = (typeMap[wt] || 0) + w;
      allTypes.add(wt);

      if (!deptMap[dept]) deptMap[dept] = {};
      deptMap[dept][wt] = (deptMap[dept][wt] || 0) + w;
    });

    const lineData = Object.values(dayMap)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ label, types }) => {
        const row: Record<string, any> = { date: label };
        Array.from(allTypes).forEach((typeKey) => {
          row[typeKey] = Math.round((types[typeKey] || 0) * 100) / 100;
        });
        return row;
      });
    const pieData = Object.entries(typeMap).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
    
    const deptData = Object.entries(deptMap).map(([dept, types]) => {
      const roundedTypes: Record<string, number> = {};
      let total = 0;
      Object.entries(types).forEach(([k, v]) => {
        const roundedVal = Math.round(v * 100) / 100;
        roundedTypes[k] = roundedVal;
        total += roundedVal;
      });
      return {
        dept,
        ...roundedTypes,
        total: Math.round(total * 100) / 100,
      };
    });

    const totalWeight = logsInRange.reduce((s: number, l: any) => s + Number(l.weight), 0);

    return {
      lineData,
      pieData,
      deptData,
      totalWeight: Math.round(totalWeight * 100) / 100,
      typeTotals: typeMap,
      allTypes: Array.from(allTypes),
    };
  }, [combinedLogs, chartRange]);

  const totalCost = useMemo(() => {
    let cost = 0;
    Object.keys(typesMap).forEach((k) => {
      const normalizedKey = normalizeWasteType(k);
      const weight = combinedTypeTotals[normalizedKey] || 0;
      const rate = costPerKg[normalizedKey] || 0;
      cost += weight * rate;
    });
    return Math.round(cost * 100) / 100;
  }, [combinedTypeTotals, typesMap, costPerKg]);

  // ฟังก์ชันช่วยเหลือในการจับคู่สีชาร์ตจากคีย์ดึงมาจากฐานข้อมูลจริง
  const getColorByLabelName = (labelName: string) => {
    const entry = Object.entries(typesMap).find(([_, v]) => v.label === labelName);
    if (entry) return entry[1].chartColor;
    return FALLBACK_CHART_COLORS[0];
  };

  const handleAdvancedExport = () => {
    const sourceLogs = filteredLogs.length > 0 ? filteredLogs : logs;
    if (!sourceLogs || sourceLogs.length === 0) { toast.info("ไม่มีข้อมูลให้ส่งออก"); return; }
    const headers = ["วันที่", "แผนก", "น้ำหนัก (กก.)", "ขยะทั่วไป", "ขยะเปียก", "ขยะติดเชื้อ", "ขยะอันตราย", "ขยะรีไซเคิล"];
    const buildRows = (rows: any[]) => [...rows]
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((l: any) => {
        const t = normalizeWasteType(l.waste_type);
        const w = Number(l.weight) || 0;
        return [
          format(new Date(l.created_at), "d/M/yyyy"),
          l.departments?.name || "-",
          w,
          t === "general" ? w : "",
          t === "organic" ? w : "",
          t === "infectious" ? w : "",
          t === "hazardous" ? w : "",
          t === "recycle" ? w : "",
        ];
      });

    const wb = XLSX.utils.book_new();
    const allRows = buildRows(sourceLogs);
    const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
    wsAll["!cols"] = headers.map(() => ({ wch: 14 }));
    XLSX.utils.book_append_sheet(wb, wsAll, "บันทึกขยะรวม");

    const byDept: Record<string, any[]> = {};
    sourceLogs.forEach((l: any) => {
      const name = l.departments?.name || "ไม่ระบุแผนก";
      (byDept[name] = byDept[name] || []).push(l);
    });
    Object.entries(byDept).forEach(([deptName, rows]) => {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...buildRows(rows)]);
      ws["!cols"] = headers.map(() => ({ wch: 14 }));
      const safeName = (deptName || "แผนก").substring(0, 28).replace(/[\\/*?[\]:]/g, "-");
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });
    XLSX.writeFile(wb, `waste-logs_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  const handleInfectiousExport = () => {
    if (!filteredInfectious || filteredInfectious.length === 0) { 
      toast.info("ไม่มีข้อมูลขยะติดเชื้อให้ส่งออก"); 
      return; 
    }
    
    const headers = ["วันที่รับขยะ", "แหล่งที่มา/หน่วยงาน", "ขยะมีคม (กก.)", "ขยะไม่มีคม (กก.)", "น้ำหนักรวม (กก.)", "ผู้ส่งมอบ", "วันที่ส่งต่อกำจัด"];
    const buildInfRows = (rows: any[]) => [...rows]
      .sort((a: any, b: any) => new Date(a.collection_date || a.created_at).getTime() - new Date(b.collection_date || b.created_at).getTime())
      .map((r: any) => {
        const sharp = Number(r.sharp_waste_kg) || 0;
        const nonSharp = Number(r.non_sharp_waste_kg) || 0;
        return [
          r.collection_date ? format(new Date(r.collection_date), "d/M/yyyy") : "-",
          r.health_center_name || "-",
          sharp,
          nonSharp,
          sharp + nonSharp,
          r.delivered_by || "-",
          r.transfer_date ? format(new Date(r.transfer_date), "d/M/yyyy") : "-"
        ];
      });

    const wb = XLSX.utils.book_new();
    const allRows = buildInfRows(filteredInfectious);
    const wsAll = XLSX.utils.aoa_to_sheet([headers, ...allRows]);
    wsAll["!cols"] = headers.map(() => ({ wch: 16 }));
    XLSX.utils.book_append_sheet(wb, wsAll, "รวม รพ.สต. ทั้งหมด");

    const byCenter: Record<string, any[]> = {};
    filteredInfectious.forEach((r: any) => {
      const centerName = r.health_center_name || "ไม่ระบุหน่วยงาน";
      (byCenter[centerName] = byCenter[centerName] || []).push(r);
    });
    
    Object.entries(byCenter).forEach(([centerName, rows]) => {
      const ws = XLSX.utils.aoa_to_sheet([headers, ...buildInfRows(rows)]);
      ws["!cols"] = headers.map(() => ({ wch: 16 }));
      const safeName = centerName.substring(0, 28).replace(/[\\/*?[\]:]/g, "-");
      XLSX.utils.book_append_sheet(wb, ws, safeName);
    });
    
    XLSX.writeFile(wb, `infectious-waste-report_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
    toast.success("ส่งออกข้อมูลขยะติดเชื้อสำเร็จ");
  };

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูลขยะ" subtitle="บันทึก วิเคราะห์ และคำนวณต้นทุน">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1" onClick={handleAdvancedExport}>
          <Download className="h-3.5 w-3.5" /> Export Excel
        </Button>
      </PageHeader>

      <Button
        className="w-full h-14 rounded-2xl text-base font-bold gap-2 shadow-elevated bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        onClick={() => {
          setEditingLogId(null);
          setWeight("");
          setCustomDateTime("");
          setCustomRecorder("");
          setInfRows([emptyInfRow()]);
          setInfCollectionDate(new Date());
          setInfTransferDate(undefined);
          setShowForm(true);
        }}
      >
        <Plus className="h-5 w-5" /> บันทึกน้ำหนักขยะ
      </Button>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto rounded-2xl bg-muted/60 p-1 gap-1">
          <TabsTrigger value="dashboard" className="rounded-xl text-sm md:text-base font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">แดชบอร์ด</TabsTrigger>
          <TabsTrigger value="records" className="rounded-xl text-sm md:text-base font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">รายการ</TabsTrigger>
          <TabsTrigger value="infectious" className="rounded-xl text-sm md:text-base font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:text-orange-700 data-[state=active]:shadow-sm">ขยะติดเชื้อ</TabsTrigger>
          <TabsTrigger value="cost" className="rounded-xl text-sm md:text-base font-semibold text-slate-700 data-[state=active]:bg-white data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm">ต้นทุน</TabsTrigger>
        </TabsList>

        <Card className="shadow-lg mt-4 border border-slate-200 rounded-2xl bg-white">
          <CardContent className="p-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-10 text-sm w-32 rounded-2xl">{getWasteTypeLabelByKey(filterType)}</SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกประเภท</SelectItem>
                  {Object.entries(typesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-10 text-sm w-28 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทั้งหมด</SelectItem>
                  <SelectItem value="day">วันนี้</SelectItem>
                  <SelectItem value="week">สัปดาห์นี้</SelectItem>
                  <SelectItem value="month">เดือนนี้</SelectItem>
                  <SelectItem value="custom">เลือกวันที่</SelectItem>
                </SelectContent>
              </Select>
              <Badge variant="secondary" className="h-10 px-4 flex items-center text-sm rounded-2xl">{combinedLogs.length} รายการ</Badge>
            </div>
            {filterPeriod === "custom" && (
              <div className="flex flex-wrap gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-sm h-10 w-40 justify-start rounded-2xl font-semibold text-slate-900 border-slate-400">
                      {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="text-sm h-10 w-40 justify-start rounded-2xl font-semibold text-slate-900 border-slate-400">
                      {customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </CardContent>
        </Card>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="shadow-lg border-0 rounded-3xl bg-gradient-to-br from-sky-50 to-sky-100/50 backdrop-blur-sm">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-extrabold text-sky-600">{chartData.totalWeight}</p>
                <p className="text-xs text-muted-foreground mt-1">น้ำหนักรวม (กก.)</p>
              </CardContent>
            </Card>
            {Object.entries(typesMap).map(([k, v]) => {
              const normalizedTypeKey = normalizeWasteType(k);
              const typeLabel = getWasteTypeLabel(normalizedTypeKey);
              const typeWeight = chartData.typeTotals?.[typeLabel] || 0;
              return (
                <Card key={k} className="shadow-lg border-0 rounded-3xl bg-white/80 backdrop-blur-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
                  <CardContent className="p-4 text-center">
                    <div className="w-8 h-8 rounded-full mx-auto mb-2 shadow-sm" style={{ background: v.chartColor, opacity: 0.8 }} />
                    <p className="text-2xl font-extrabold" style={{ color: v.chartColor }}>{Math.round(typeWeight * 100) / 100}</p>
                    <p className="text-xs text-muted-foreground mt-1">{v.label} (กก.)</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {chartData.lineData.length > 0 && (
            <Card className="shadow-card border border-border/50 rounded-3xl bg-white">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">แนวโน้มขยะรายวัน</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">น้ำหนักรวมแต่ละประเภท (กก.) · ค่าเริ่มต้น 7 วันล่าสุด</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs" onClick={() => { const d = new Date(); const f = new Date(); f.setDate(f.getDate() - 6); setChartFrom(startOfDay(f)); setChartTo(d); }}>7 วัน</Button>
                    <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs" onClick={() => { const d = new Date(); const f = new Date(); f.setDate(f.getDate() - 29); setChartFrom(startOfDay(f)); setChartTo(d); }}>30 วัน</Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs gap-1"><CalendarIcon className="h-3.5 w-3.5" />{format(chartFrom, "d MMM", { locale: th })}</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={chartFrom} onSelect={(d) => d && setChartFrom(d)} disabled={(d) => d > chartTo} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                    </Popover>
                    <span className="text-xs text-muted-foreground">—</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button size="sm" variant="outline" className="h-9 rounded-2xl text-xs gap-1"><CalendarIcon className="h-3.5 w-3.5" />{format(chartTo, "d MMM", { locale: th })}</Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={chartTo} onSelect={(d) => d && setChartTo(d)} disabled={(d) => d < chartFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData.lineData}>
                      <defs>
                        {chartData.allTypes.map((typeLabel, i) => {
                          const calculatedColor = getColorByLabelName(typeLabel);
                          return (
                            <linearGradient key={typeLabel} id={`wasteGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={calculatedColor} stopOpacity={0.4} />
                              <stop offset="95%" stopColor={calculatedColor} stopOpacity={0.05} />
                            </linearGradient>
                          );
                        })}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: any) => `${Number(value).toFixed(2)} กก.`} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {chartData.allTypes.map((typeLabel, i) => (
                        <Area 
                          key={typeLabel} 
                          type="monotone" 
                          dataKey={typeLabel} 
                          fill={`url(#wasteGrad-${i})`} 
                          stroke={getColorByLabelName(typeLabel)} 
                          strokeWidth={2} 
                        />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {chartData.pieData.length > 0 && (
              <Card className="shadow-card border border-border/50 rounded-3xl bg-white">
                <CardContent className="p-5">
                  <h3 className="text-base font-bold text-foreground mb-4">สัดส่วนประเภทขยะ</h3>
                  <div className="h-60 w-full flex items-center justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {chartData.pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColorByLabelName(entry.name)} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `${Number(value).toFixed(2)} กก.`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {chartData.deptData.length > 0 && (
              <Card className="shadow-card border border-border/50 rounded-3xl bg-white">
                <CardContent className="p-5">
                  <h3 className="text-base font-bold text-foreground mb-4">ปริมาณขยะแยกตามแผนก (กก.)</h3>
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.deptData} layout="vertical" margin={{ left: 10, right: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis dataKey="dept" type="category" tick={{ fontSize: 10 }} width={70} />
                        <Tooltip formatter={(value) => `${Number(value).toFixed(2)} กก.`} />
                        <Bar dataKey="total" fill="#0ea5e9" radius={[0, 4, 4, 0]} name="น้ำหนักรวม" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Card className="shadow-card border border-border/50 rounded-3xl bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs uppercase font-bold">
                      <th className="p-4">วันที่</th>
                      <th className="p-4">ประเภท</th>
                      <th className="p-4">แผนก</th>
                      <th className="p-4">น้ำหนัก (กก.)</th>
                      <th className="p-4">ผู้บันทึก</th>
                      <th className="p-4 text-center">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {combinedLogs.map((log: any) => {
                      const meta = getWasteTypeMeta(log.waste_type);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium text-slate-700">{format(new Date(log.created_at), "d MMM yyyy · HH:mm", { locale: th })}</td>
                          <td className="p-4">
                            <Badge variant="outline" className={cn("rounded-xl px-2.5 py-0.5 text-xs font-semibold border shadow-sm", meta?.color)}>
                              {getWasteTypeLabel(log.waste_type)}
                            </Badge>
                          </td>
                          <td className="p-4 text-slate-600">{log.departments?.name || "ไม่ระบุ"}</td>
                          <td className="p-4 font-bold text-slate-900">{Number(log.weight).toFixed(2)}</td>
                          <td className="p-4 text-xs text-slate-500">{log.recorded_by_name || "ระบบ"}</td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1">
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl" onClick={() => handleEditLog(log)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl" onClick={() => { if(confirm("ต้องการลบรายการนี้หรือไม่?")) deleteLog.mutate(log.id); }}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {combinedLogs.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-8 text-slate-400">ไม่มีข้อมูลตามตัวกรองที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infectious" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h3 className="text-base font-bold text-slate-900">ทะเบียนคุมขยะติดเชื้อรายหน่วยงาน</h3>
              <p className="text-xs text-slate-500 mt-0.5">รวมน้ำหนักตามตัวกรองช่วงเวลาด้านบน: <span className="font-bold text-orange-600">{infectiousFilteredTotal.toFixed(2)} กก.</span></p>
            </div>
            <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1" onClick={handleInfectiousExport}>
              <Download className="h-3.5 w-3.5" /> Export Excel
            </Button>
          </div>

          <Card className="shadow-card border border-border/50 rounded-3xl bg-white overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold">
                      <th className="p-4">วันที่รับขยะ</th>
                      <th className="p-4">แหล่งที่มา / หน่วยงาน</th>
                      <th className="p-4">ขยะมีคม (กก.)</th>
                      <th className="p-4">ขยะไม่มีคม (กก.)</th>
                      <th className="p-4">น้ำหนักรวม (กก.)</th>
                      <th className="p-4">ผู้ส่งมอบ</th>
                      <th className="p-4">วันที่ส่งต่อกำจัด</th>
                      {isAdmin && <th className="p-4 text-center">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                     {[...filteredInfectious]
                       .sort((a: any, b: any) => {
                         const da = new Date(a.collection_date || a.created_at || 0).getTime();
                         const db = new Date(b.collection_date || b.created_at || 0).getTime();
                         return db - da;
                       })
                       .map((r: any) => {
                      const total = (Number(r.sharp_waste_kg) || 0) + (Number(r.non_sharp_waste_kg) || 0);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-medium">{r.collection_date ? format(new Date(r.collection_date), "d MMM yyyy", { locale: th }) : "-"}</td>
                          <td className="p-4 font-semibold text-slate-900">{r.health_center_name}</td>
                          <td className="p-4">{Number(r.sharp_waste_kg || 0).toFixed(2)}</td>
                          <td className="p-4">{Number(r.non_sharp_waste_kg || 0).toFixed(2)}</td>
                          <td className="p-4 font-bold text-orange-600">{total.toFixed(2)}</td>
                          <td className="p-4 text-xs text-slate-500">{r.delivered_by || "-"}</td>
                          <td className="p-4 text-xs">{r.transfer_date ? format(new Date(r.transfer_date), "d MMM yy", { locale: th }) : <span className="text-slate-400">ยังไม่ส่งมอบ</span>}</td>
                          {isAdmin && (
                            <td className="p-4 text-center">
                              <div className="flex justify-center gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-8 w-8 text-amber-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl" 
                                  onClick={() => handleEditInfectiousDirect(r.collection_date)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                                  onClick={async () => {
                                    if (!confirm("ต้องการลบรายการขยะติดเชื้อนี้หรือไม่?")) return;
                                    const { error } = await supabase.from("infectious_waste_records").delete().eq("id", r.id);
                                    if (error) { toast.error(error.message); return; }
                                    toast.success("ลบสำเร็จ");
                                    queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
                                    queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {filteredInfectious.length === 0 && (
                      <tr><td colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-slate-400">ไม่มีข้อมูลตามตัวกรองที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="shadow-lg border-0 rounded-3xl bg-gradient-to-br from-emerald-50 to-emerald-100/60 md:col-span-1">
              <CardContent className="p-5 text-center flex flex-col justify-center h-full">
                <p className="text-3xl font-black text-emerald-700">฿{totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                <p className="text-sm font-semibold text-emerald-800 mt-1">ประมาณการค่าใช้จ่ายรวม</p>
                <p className="text-xs text-muted-foreground mt-0.5">คำนวณตามน้ำหนักขยะในช่วงเวลาที่เลือก</p>
                {isAdmin && (
                  <div className="mt-4 flex gap-2 justify-center">
                    <Button size="sm" variant="outline" className="rounded-xl text-xs bg-white/80" onClick={() => setManageTypesOpen(true)}>ตั้งค่าราคาต่อกิโล</Button>
                    <Button size="sm" variant="outline" className="rounded-xl text-xs bg-white/80" onClick={() => setManageDeptsOpen(true)}>จัดการรายชื่อแผนก</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-card border border-border/50 rounded-3xl bg-white md:col-span-2 overflow-hidden">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-600 text-xs font-bold">
                        <th className="p-4">ประเภทขยะ</th>
                        <th className="p-4">น้ำหนักรวม (กก.)</th>
                        <th className="p-4">อัตราค่ากำจัด (บาท/กก.)</th>
                        <th className="p-4 text-right">คิดเป็นเงิน (บาท)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {Object.entries(typesMap).map(([k, v]) => {
                        const normalizedKey = normalizeWasteType(k);
                        const weight = combinedTypeTotals[normalizedKey] || 0;
                        const rate = costPerKg[normalizedKey] || 0;
                        const amt = weight * rate;
                        if (weight === 0 && rate === 0) return null;
                        return (
                          <tr key={k} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 font-medium text-slate-800">{v.label}</td>
                            <td className="p-4 font-semibold text-slate-700">{Number(weight).toFixed(2)}</td>
                            <td className="p-4 text-slate-500">฿{rate.toFixed(2)}</td>
                            <td className="p-4 text-right font-bold text-slate-900">฿{amt.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <div className="w-2 h-6 bg-emerald-500 rounded-full" />
              {editingLogId ? "แก้ไขข้อมูลและน้ำหนักขยะ" : "บันทึกข้อมูลและน้ำหนักขยะประจำวัน"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">ประเภทขยะที่ต้องการบันทึก</Label>
                <Select value={wasteType} onValueChange={setWasteType}>
                  <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px] overflow-y-auto bg-white z-[9999]">
                    <SelectScrollUpButton />
                    {Object.entries(typesMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                    <SelectScrollDownButton />
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">แผนก/อาคารที่รับผิดชอบ</Label>
                <Select value={selectedDept} onValueChange={setSelectedDept}>
                  <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200">
                    <SelectValue placeholder="เลือกแผนก" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-[300px] overflow-y-auto bg-white z-[9999]">
                    <SelectScrollUpButton />
                    {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    <SelectScrollDownButton />
                  </SelectContent>
                </Select>
              </div>

              {wasteType !== "infectious" && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">น้ำหนักสุทธิ (กิโลกรัม)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="h-11 rounded-xl bg-white border-slate-200 text-lg font-bold text-slate-900"
                  />
                </div>
              )}
            </div>

            {wasteType === "infectious" && (
              <div className="space-y-4 border border-orange-100 bg-orange-50/30 p-4 rounded-2xl">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-orange-100 pb-3">
                  <div>
                    <h4 className="text-sm font-bold text-orange-900">รายละเอียดขยะติดเชื้อรายหน่วยงาน (รพ.สต.)</h4>
                    <p className="text-xs text-orange-700/80 mt-0.5">กรอกข้อมูลแยกแต่ละ รพ.สต.</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-500">วันที่รับขยะ</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 rounded-xl bg-white text-xs gap-1 font-bold border-slate-200">
                            <CalendarIcon className="h-3 w-3 text-orange-500" />
                            {infCollectionDate ? format(infCollectionDate, "d MMM yy", { locale: th }) : "เลือกวัน"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar mode="single" selected={infCollectionDate} onSelect={setInfCollectionDate} initialFocus className="p-2" />
                        </PopoverContent>
                      </Popover>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-500">วันที่ส่งต่อกำจัด</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 rounded-xl bg-white text-xs gap-1 font-bold border-slate-200">
                            <CalendarIcon className="h-3 w-3 text-slate-400" />
                            {infTransferDate ? format(infTransferDate, "d MMM yy", { locale: th }) : "ยังไม่ส่งต่อ"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="end">
                          <Calendar mode="single" selected={infTransferDate} onSelect={setInfTransferDate} initialFocus className="p-2" />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                  {infRows.map((row, i) => (
                    <div key={i} className="grid grid-cols-1 md:grid-cols-12 gap-2 bg-white p-3 rounded-xl border border-slate-100 shadow-sm items-end relative group">
                      <div className="md:col-span-3 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">แหล่งที่มา ({i+1})</span>
                        <Select
                          value={row.health_center_name}
                          onValueChange={(val) => setInfRows(prev => { const n = [...prev]; n[i].health_center_name = val; return n; })}
                        >
                          <SelectTrigger className="h-9 text-xs rounded-lg">
                            <SelectValue placeholder="เลือก รพ.สต." />
                          </SelectTrigger>
                          <SelectContent position="popper" className="max-h-[300px] overflow-y-auto bg-white z-[9999]">
                            <SelectScrollUpButton />
                            {HEALTH_CENTERS.map((hc) => <SelectItem key={hc} value={hc}>{hc}</SelectItem>)}
                            <SelectScrollDownButton />
                          </SelectContent>
                        </Select>
                      </div>

                      {row.health_center_name === "โรงพยาบาลแม่สรวย" ? (
                        <div className="md:col-span-4 space-y-1">
                          <span className="text-[11px] font-bold text-slate-500">น้ำหนักขยะติดเชื้อ (กก.)</span>
                          <Input
                            type="number"
                            step="0.1"
                            placeholder="0.0"
                            value={row.sharp_waste_kg}
                            onChange={(e) => setInfRows(prev => {
                              const n = [...prev];
                              n[i].sharp_waste_kg = e.target.value;
                              n[i].non_sharp_waste_kg = "";
                              return n;
                            })}
                            className="h-9 text-xs rounded-lg font-mono font-bold"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="md:col-span-2 space-y-1">
                            <span className="text-[11px] font-bold text-slate-500">ขยะมีคม (กก.)</span>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              value={row.sharp_waste_kg}
                              onChange={(e) => setInfRows(prev => { const n = [...prev]; n[i].sharp_waste_kg = e.target.value; return n; })}
                              className="h-9 text-xs rounded-lg font-mono font-bold"
                            />
                          </div>
                          <div className="md:col-span-2 space-y-1">
                            <span className="text-[11px] font-bold text-slate-500">ขยะไม่มีคม (กก.)</span>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              value={row.non_sharp_waste_kg}
                              onChange={(e) => setInfRows(prev => { const n = [...prev]; n[i].non_sharp_waste_kg = e.target.value; return n; })}
                              className="h-9 text-xs rounded-lg font-mono font-bold"
                            />
                          </div>
                        </>
                      )}

                      <div className="md:col-span-2 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">ผู้ส่งมอบ/คนขับ</span>
                        <Input
                          placeholder="ชื่อผู้ส่ง"
                          value={row.delivered_by}
                          onChange={(e) => setInfRows(prev => { const n = [...prev]; n[i].delivered_by = e.target.value; return n; })}
                          className="h-9 text-xs rounded-lg"
                        />
                      </div>

                      <div className="md:col-span-2 space-y-1">
                        <span className="text-[11px] font-bold text-slate-500">ประเภทรถ/ถัง</span>
                        <Input
                          placeholder="เช่น รถกระบะ"
                          value={row.source_type}
                          onChange={(e) => setInfRows(prev => { const n = [...prev]; n[i].source_type = e.target.value; return n; })}
                          className="h-9 text-xs rounded-lg"
                        />
                      </div>

                      <div className="md:col-span-1 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={infRows.length === 1}
                          className="h-9 w-9 text-slate-400 hover:text-rose-500 rounded-lg"
                          onClick={() => setInfRows(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-10 border-dashed border-orange-300 text-orange-700 hover:bg-orange-50 rounded-xl font-bold gap-1 mt-1"
                  onClick={() => setInfRows(prev => [...prev, emptyInfRow()])}
                >
                  <Plus className="h-4 w-4" /> เพิ่มรายชื่อ รพ.สต. ถัดไป
                </Button>
              </div>
            )}

            {isAdmin && (
              <div className="p-4 bg-amber-50/50 border border-amber-200/60 rounded-2xl space-y-3">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">แผงควบคุมสิทธิ์ผู้ดูแลระบบ (ลงบันทึกย้อนหลัง)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">กำหนดวันเวลาลงบันทึกเจาะจง</Label>
                    <Input
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => setCustomDateTime(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white border-slate-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-600">ชื่อผู้บันทึกแทน (Override Name)</Label>
                    <Input
                      placeholder="ใส่ชื่อเจ้าหน้าที่กรณีบันทึกย้อนหลังแทน"
                      value={customRecorder}
                      onChange={(e) => setCustomRecorder(e.target.value)}
                      className="h-10 text-xs rounded-xl bg-white border-slate-200"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 justify-end border-t pt-4">
              <Button type="button" variant="ghost" className="rounded-xl h-11 px-5" onClick={() => setShowForm(false)}>ยกเลิก</Button>
              <Button
                type="button"
                className="rounded-xl h-11 px-6 font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md"
                onClick={() => createLog.mutate()}
                disabled={createLog.isPending}
              >
                {createLog.isPending ? "กำลังบันทึก..." : "ยืนยันการบันทึกข้อมูล"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageDeptsOpen} onOpenChange={setManageDeptsOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-bold">จัดการรายชื่อแผนก/อาคาร</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex gap-2">
              <Input
                placeholder="ชื่อแผนกใหม่"
                value={deptEditName}
                onChange={(e) => setDeptEditName(e.target.value)}
                className="h-10 rounded-xl"
              />
              <Button size="sm" className="h-10 rounded-xl px-4 font-bold" onClick={() => saveDepartment.mutate({ id: deptEditId, name: deptEditName })} disabled={saveDepartment.isPending}>
                {deptEditId ? "แก้ไข" : "เพิ่ม"}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto border rounded-xl divide-y text-sm">
              {departments.map((d: any) => (
                <div key={d.id} className="p-2.5 flex justify-between items-center bg-white hover:bg-slate-50">
                  <span className="font-medium text-slate-700">{d.name}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => { setDeptEditId(d.id); setDeptEditName(d.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-500" onClick={() => { if(confirm("ลบแผนกนี้?")) deleteDepartment.mutate(d.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageTypesOpen} onOpenChange={setManageTypesOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl">
          <DialogHeader><DialogTitle className="text-base font-bold">ตั้งค่าอัตราค่ากำจัดขยะ (บาท/กก.)</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {Object.entries(typesMap).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b pb-2">
                <span className="text-sm font-bold text-slate-700">{v.label} ({k})</span>
                <div className="flex items-center gap-1 w-28">
                  <span className="text-xs text-slate-400">฿</span>
                  <Input
                    type="number"
                    value={costPerKg[normalizeWasteType(k)] ?? 0}
                    onChange={(e) => setCostPerKg(prev => ({ ...prev, [normalizeWasteType(k)]: parseFloat(e.target.value) || 0 }))}
                    className="h-9 font-bold text-right rounded-lg"
                  />
                </div>
              </div>
            ))}

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100 mt-2">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">เพิ่มประเภทขยะระบบภายในเพิ่มเติม</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="คีย์ (เช่น organic)" value={newTypeKey} onChange={(e) => setNewTypeKey(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="ป้ายชื่อใหม่" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} className="h-12 rounded-2xl" />
              </div>
              <Button className="h-12 rounded-2xl w-full" onClick={() => {
                const trimmedKey = newTypeKey.trim();
                const trimmedLabel = newTypeLabel.trim();
                if (!trimmedKey || !trimmedLabel) {
                  toast.error("กรุณากรอกคีย์และป้ายชื่อ");
                  return;
                }
                if (typesMap[trimmedKey]) {
                  toast.error("คีย์นี้มีอยู่แล้ว");
                  return;
                }
                setTypesMap(prev => ({
                  ...prev,
                  [trimmedKey]: {
                    label: trimmedLabel,
                    color: "bg-slate-200 text-slate-800 border-slate-300",
                    chartColor: "hsl(210 15% 55%)",
                  },
                }));
                setNewTypeKey("");
                setNewTypeLabel("");
              }}>
                เพิ่มประเภทใหม่
              </Button>
            </div>
            <Button className="w-full h-12 rounded-2xl" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>
              {saveWasteSettings.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
