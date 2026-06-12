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
import { exportToExcel } from "@/lib/exportExcel";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "hsl(210 15% 55%)" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "hsl(0 72% 55%)" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "hsl(152 55% 42%)" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "hsl(45 90% 50%)" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "hsl(100 50% 40%)" },
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

const PIE_COLORS = ["hsl(210 15% 55%)", "hsl(0 72% 55%)", "hsl(152 55% 42%)", "hsl(45 90% 50%)"];

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
  const [selectedLog, setSelectedLog] = useState<any>(null);
  // Admin backdate fields
  const [customDateTime, setCustomDateTime] = useState("");
  const [customRecorder, setCustomRecorder] = useState("");

  // Chart date range (default last 7 days, client-side filter only)
  const [chartFrom, setChartFrom] = useState<Date>(() => { const d = new Date(); d.setDate(d.getDate() - 6); return startOfDay(d); });
  const [chartTo, setChartTo] = useState<Date>(() => new Date());

  // Infectious-waste dynamic form rows (inside unified modal)
  const HEALTH_CENTERS = [
    "รพ.สต.โป่งปูเฟือง","รพ.สต.โป่งกลางน้ำ","รพ.สต.ทุ่งพร้าว","รพ.สต.ห้วยไคร้",
    "รพ.สต.วาวี","รพ.สต.บ้านดอยช้าง","รพ.สต.แม่สรวย","โรงพยาบาลแม่สรวย","รพ.สต.เจดีย์หลวง",
    "รพ.สต.ศรีถ้อย","รพ.สต.ห้วยน้ำขุ่น","รพ.สต.ท่าก๊อ","รพ.สต.ป่าแดด",
  ];
  const emptyInfRow = () => ({ health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "", source_type: "", bottle_count: "" });
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

  // load persisted waste types and costs from app_settings
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

      // Infectious waste: insert rich rows + aggregated weight into waste_logs
      if (wasteType === "infectious") {
        const valid = infRows.filter((r: any) => r.health_center_name?.trim());
        if (valid.length === 0) throw new Error("กรุณากรอกชื่อหน่วยงานอย่างน้อย 1 รายการ");
        if (!infCollectionDate) throw new Error("กรุณาเลือกวันที่รับขยะ");
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

        // Aggregate total into waste_logs so dashboard / cost reflects it
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
          const { error: errAgg } = await supabase.from("waste_logs").insert(aggPayload);
          if (errAgg) throw errAgg;

          if (totalKg >= 10) {
            try {
              const deptName = departments.find((d: any) => d.id === selectedDept)?.name || "ไม่ระบุ";
              await supabase.functions.invoke("line-notify", {
                body: { message: `🔴 แจ้งเตือน: บันทึกขยะติดเชื้อน้ำหนักสูง ${totalKg} กก.\nแผนก: ${deptName}\nผู้บันทึก: ${profile?.full_name}` },
              });
            } catch {}
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
      const { error } = await supabase.from("waste_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกน้ำหนักขยะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
      queryClient.invalidateQueries({ queryKey: ["waste-history"] });
      queryClient.invalidateQueries({ queryKey: ["waste-filtered"] });
      setShowForm(false);
      setWeight("");
      setCustomDateTime("");
      setCustomRecorder("");
      setInfRows([emptyInfRow()]);
      setInfCollectionDate(new Date());
      setInfTransferDate(undefined);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteLog = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("waste_logs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      queryClient.invalidateQueries({ queryKey: ["waste-history"] });
      queryClient.invalidateQueries({ queryKey: ["waste-filtered"] });
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
      queryClient.invalidateQueries({ queryKey: ["app_settings"] });
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

  const combinedLogs = useMemo(() => {
    const normalizedFilter = normalizeWasteType(filterType);
    const baseLogs = [...filteredLogs];
    if (normalizedFilter !== "infectious" && normalizedFilter !== "all" && filterType !== "all") {
      return baseLogs;
    }

    const filteredInf = (() => {
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
    })();

    const existingKeys = new Set(baseLogs
      .filter((log: any) => normalizeWasteType(log.waste_type) === "infectious")
      .map((log: any) => `${new Date(log.created_at).toISOString()}|${Number(log.weight)}`));

    filteredInf.forEach((record: any) => {
      const weight = Number(record.sharp_waste_kg || 0) + Number(record.non_sharp_waste_kg || 0);
      const createdAt = record.collection_date ? new Date(record.collection_date).toISOString() : new Date(record.created_at || record.transfer_date || new Date()).toISOString();
      const key = `${createdAt}|${weight}`;
      if (!existingKeys.has(key)) {
        baseLogs.push({
          id: `infectious-${createdAt}-${weight}`,
          waste_type: "infectious",
          weight,
          created_at: createdAt,
          department_id: "",
          recorded_by: "",
          recorded_by_name: "",
          departments: { name: "" },
        } as any);
        existingKeys.add(key);
      }
    });
    return baseLogs;
  }, [filteredLogs, filterType, filterPeriod, customFrom, customTo, infectiousWasteRecords]);

  // Chart data
  const chartData = useMemo(() => {
    const dayMap: Record<string, { sortKey: string; label: string; types: Record<string, number> }> = {};
    const typeMap: Record<string, number> = {};
    const deptMap: Record<string, Record<string, number>> = {};
    const allTypes = new Set<string>();

    const rangeStart = startOfDay(chartFrom).getTime();
    const rangeEnd = startOfDay(chartTo).getTime() + 86400000 - 1;
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
    const deptData = Object.entries(deptMap).map(([dept, types]) => ({
      dept,
      ...types,
      total: Object.values(types).reduce((a, b) => a + b, 0),
    }));
    const totalWeight = combinedLogs.reduce((s: number, l: any) => s + Number(l.weight), 0);

    return { lineData, pieData, deptData, totalWeight: Math.round(totalWeight * 100) / 100, allTypes: Array.from(allTypes) };
  }, [combinedLogs, typesMap, chartFrom, chartTo]);

  // Cost calculation
  const totalCost = useMemo(() => {
    let cost = 0;
    combinedLogs.forEach((log: any) => {
      const rate = costPerKg[normalizeWasteType(log.waste_type)] || 0;
      cost += Number(log.weight) * rate;
    });
    return Math.round(cost * 100) / 100;
  }, [combinedLogs, costPerKg]);

  // Apply the same date filter (filterPeriod / custom) to infectious_waste_records,
  // matched on collection_date (fallback transfer_date / created_at).
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

  /**
   * Client-side Excel export (Disk I/O = 0%).
   * - Sheet 1 "บันทึกขยะรวม": columns matching user-supplied template.
   * - One sheet per department with the same columns, oldest → newest.
   */
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

    // group by department
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

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูลขยะ" subtitle="บันทึก วิเคราะห์ และคำนวณต้นทุน">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1" onClick={handleAdvancedExport}>
          <Download className="h-3.5 w-3.5" /> Export Excel
        </Button>
      </PageHeader>

      {/* Prominent record button */}
      <Button
        className="w-full h-14 rounded-2xl text-base font-bold gap-2 shadow-elevated bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white"
        onClick={() => setShowForm(true)}
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
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl font-semibold", !customFrom ? "text-slate-900 border-slate-400" : "text-slate-900 border-slate-400")}>
                      {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl font-semibold", !customTo ? "text-slate-900 border-slate-400" : "text-slate-900 border-slate-400")}>
                      {customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)} initialFocus className={cn("p-3 pointer-events-auto")} />
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
              const typeWeight = normalizedTypeKey === "infectious"
                ? infectiousFilteredTotal
                : combinedLogs.filter((l: any) => normalizeWasteType(l.waste_type) === normalizedTypeKey).reduce((s: number, l: any) => s + Number(l.weight), 0);
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
                      <PopoverContent className="w-auto p-0" align="end"><Calendar mode="single" selected={chartTo} onSelect={(d) => d && setChartTo(d)} disabled={(d) => d > new Date() || d < chartFrom} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={chartData.lineData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 92%)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={{ stroke: "#e2e8f0" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} width={40} />
                    <Tooltip
                      contentStyle={{ borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,0.08)", fontSize: 12 }}
                      formatter={(value: number, name: string) => [`${value} กก.`, name]}
                      labelStyle={{ fontWeight: 700, color: "#0f172a", marginBottom: 4 }}
                    />
                    <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    {Object.entries(typesMap).map(([_, wt]) => (
                      <Bar
                        key={wt.label}
                        dataKey={wt.label}
                        fill={wt.chartColor}
                        radius={[6, 6, 0, 0]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {chartData.pieData.length > 0 && (
            <Card className="shadow-card border border-border/50 rounded-2xl">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-3">สัดส่วนขยะแต่ละประเภท</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={chartData.pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={85} paddingAngle={4} dataKey="value">
                      {chartData.pieData.map((item: any) => {
                        const typeEntry = Object.entries(typesMap).find(([_, v]) => v.label === item.name);
                        const color = typeEntry ? typeEntry[1].chartColor : "hsl(210 15% 55%)";
                        return <Cell key={item.name} fill={color} />;
                      })}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v} กก.`} />
                    <Legend iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {infectiousWasteRecords.length > 0 && (
            <Card className="shadow-card border border-red-200/50 rounded-3xl bg-gradient-to-br from-red-50 to-red-50/30">
              <CardContent className="p-5">
                <h3 className="text-base font-bold text-foreground mb-4 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: "hsl(0 72% 55%)" }} />
                  ข้อมูลขยะติดเชื้อ
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">ขยะแหลม</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Math.round(infectiousWasteRecords.reduce((sum: number, r: any) => sum + (Number(r.sharp_waste_kg) || 0), 0) * 100) / 100}
                    </p>
                    <p className="text-xs text-muted-foreground">กก.</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-semibold">ขยะไม่แหลม</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {Math.round(infectiousWasteRecords.reduce((sum: number, r: any) => sum + (Number(r.non_sharp_waste_kg) || 0), 0) * 100) / 100}
                    </p>
                    <p className="text-xs text-muted-foreground">กก.</p>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-red-200/50">
                  <p className="text-xs text-muted-foreground mb-2">บันทึกล่าสุด (รับเข้าวันที่):</p>
                  <div className="space-y-2">
                    {infectiousWasteRecords.slice(0, 3).map((record: any) => (
                      <div key={record.id} className="text-xs flex items-center justify-between">
                        <span className="text-foreground">{record.health_center_name || "ไม่ระบุ"}</span>
                        <span className="text-muted-foreground">{new Date(record.collection_date || record.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Card className="shadow-card border border-border/50 rounded-2xl bg-white">
            <CardContent className="p-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[720px]">
                  <thead>
                    <tr className="border-b-2 border-slate-200 bg-slate-50 text-slate-700">
                      <th className="text-left px-3 py-3 text-xs font-bold">วันที่/เวลา</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">ประเภทขยะ</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">แผนก/หน่วยงาน</th>
                      <th className="text-center px-3 py-3 text-xs font-bold">น้ำหนัก (กก.)</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">ผู้บันทึก</th>
                      {isAdmin && <th className="text-center px-3 py-3 text-xs font-bold">จัดการ</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {combinedLogs.map((log: any, i: number) => {
                      const wt = getWasteTypeMeta(log.waste_type);
                      return (
                        <tr key={log.id} className={`${i % 2 ? "bg-slate-50/40" : "bg-white"} hover:bg-emerald-50/40 border-b border-slate-100 cursor-pointer transition-colors`} onClick={() => setSelectedLog(log)}>
                          <td className="px-3 py-3 text-xs whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </td>
                          <td className="px-3 py-3">
                            <Badge className={`${wt.color} border rounded-full text-[11px] font-semibold`} variant="secondary">{wt.label}</Badge>
                          </td>
                          <td className="px-3 py-3 text-xs">{log.departments?.name || "-"}</td>
                          <td className="px-3 py-3 text-center font-bold text-base text-slate-900">{log.weight}</td>
                          <td className="px-3 py-3 text-xs text-muted-foreground">{log.recorded_by_name || "-"}</td>
                          {isAdmin && (
                            <td className="px-3 py-3 text-center">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); if (confirm("ยืนยันลบ?")) deleteLog.mutate(log.id); }}>✕</Button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {combinedLogs.length === 0 && (
                      <tr><td colSpan={isAdmin ? 6 : 5} className="py-10 text-center text-muted-foreground">ไม่มีบันทึกขยะในช่วงที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="infectious" className="mt-4 space-y-3">
          <Card className="shadow-card border border-border/50 rounded-2xl bg-white">
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-base font-bold text-foreground">ประวัติขยะติดเชื้อ</h3>
                  <p className="text-xs text-muted-foreground">รวมน้ำหนัก: <span className="font-bold text-orange-600">{Math.round(infectiousFilteredTotal * 100) / 100}</span> กก. ({filteredInfectious.length} รายการ)</p>
                </div>
                <Button size="sm" variant="outline" className="rounded-2xl h-9 gap-1.5 bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => {
                  if (filteredInfectious.length === 0) { toast.info("ไม่มีข้อมูลให้ส่งออก"); return; }
                  const headers = ["ลำดับ", "วันที่รับขยะ", "วันที่ส่งต่อ", "แหล่งที่มา", "ขยะมีคม (กก.)", "ขยะไม่มีคม (กก.)", "น้ำหนักรวม (กก.)", "ผู้ส่ง"];
                  const rows = filteredInfectious.map((r: any, i: number) => [
                    i + 1,
                    r.collection_date ? new Date(r.collection_date).toLocaleDateString("th-TH") : "-",
                    r.transfer_date ? new Date(r.transfer_date).toLocaleDateString("th-TH") : "-",
                    r.health_center_name || "-",
                    Number(r.sharp_waste_kg) || 0,
                    Number(r.non_sharp_waste_kg) || 0,
                    (Number(r.sharp_waste_kg) || 0) + (Number(r.non_sharp_waste_kg) || 0),
                    r.delivered_by || "-",
                  ]);
                  const ws = XLSX.utils.aoa_to_sheet([["รายงานขยะติดเชื้อ"], [], headers, ...rows]);
                  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } }];
                  ws["!cols"] = headers.map(() => ({ wch: 18 }));
                  const wb = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(wb, ws, "ขยะติดเชื้อ");
                  XLSX.writeFile(wb, `รายงานขยะติดเชื้อ_${format(new Date(), "dd-MM-yyyy")}.xlsx`);
                  toast.success("ส่งออก Excel สำเร็จ");
                }}>
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="border-b-2 border-orange-200 bg-orange-50 text-orange-800">
                      <th className="text-left px-3 py-3 text-xs font-bold">วันที่รับขยะ</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">วันที่ส่งต่อ</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">แหล่งที่มา</th>
                      <th className="text-center px-3 py-3 text-xs font-bold">มีคม (กก.)</th>
                      <th className="text-center px-3 py-3 text-xs font-bold">ไม่มีคม (กก.)</th>
                      <th className="text-center px-3 py-3 text-xs font-bold">รวม (กก.)</th>
                      <th className="text-left px-3 py-3 text-xs font-bold">ผู้ส่ง</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInfectious.map((r: any, i: number) => {
                      const total = (Number(r.sharp_waste_kg) || 0) + (Number(r.non_sharp_waste_kg) || 0);
                      return (
                        <tr key={r.id} className={`${i % 2 ? "bg-slate-50/40" : "bg-white"} hover:bg-orange-50/40 border-b border-slate-100`}>
                          <td className="px-3 py-3 text-xs">{r.collection_date ? new Date(r.collection_date).toLocaleDateString("th-TH") : "-"}</td>
                          <td className="px-3 py-3 text-xs">{r.transfer_date ? new Date(r.transfer_date).toLocaleDateString("th-TH") : "-"}</td>
                          <td className="px-3 py-3 text-xs font-medium">{r.health_center_name || "-"}</td>
                          <td className="px-3 py-3 text-center text-xs">{r.sharp_waste_kg ?? "-"}</td>
                          <td className="px-3 py-3 text-center text-xs">{r.non_sharp_waste_kg ?? "-"}</td>
                          <td className="px-3 py-3 text-center font-bold text-orange-700">{Math.round(total * 100) / 100}</td>
                          <td className="px-3 py-3 text-xs">{r.delivered_by || "-"}</td>
                        </tr>
                      );
                    })}
                    {filteredInfectious.length === 0 && (
                      <tr><td colSpan={7} className="py-10 text-center text-muted-foreground">ไม่มีข้อมูลในช่วงที่เลือก</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cost" className="space-y-4 mt-4">
          <Card className="shadow-elevated border-0 rounded-2xl bg-gradient-to-br from-primary/10 via-accent/5 to-transparent backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <p className="text-sm font-medium text-muted-foreground mb-2">ค่าใช้จ่ายกำจัดขยะ (ประมาณ)</p>
              <p className="text-4xl font-extrabold text-primary">{totalCost.toLocaleString()} <span className="text-lg font-normal text-muted-foreground">บาท</span></p>
              <p className="text-xs text-muted-foreground mt-2">จากขยะ {chartData.totalWeight} กก.</p>
            </CardContent>
          </Card>

          {/* Cost breakdown bar chart */}
          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">กราฟค่าใช้จ่ายตามประเภทขยะ</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={Object.entries(typesMap).map(([k, v]) => {
                  const normalizedTypeKey = normalizeWasteType(k);
                  const typeWeight = combinedLogs.filter((l: any) => normalizeWasteType(l.waste_type) === normalizedTypeKey).reduce((s: number, l: any) => s + Number(l.weight), 0);
                  return { name: v.label, weight: Math.round(typeWeight * 100) / 100, cost: Math.round(typeWeight * (costPerKg[k] || 0) * 100) / 100, fill: v.chartColor };
                })} layout="vertical" margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(200 18% 90%)" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}฿`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={90} />
                  <Tooltip formatter={(v: number, name: string) => name === "cost" ? [`${v} ฿`, "ค่าใช้จ่าย"] : [`${v} กก.`, "น้ำหนัก"]} />
                  <Bar dataKey="cost" radius={[0, 8, 8, 0]}>
                    {Object.values(typesMap).map((v, i) => <Cell key={i} fill={v.chartColor} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5 space-y-3">
              <h3 className="text-base font-bold text-foreground">ตั้งค่าราคาค่ากำจัด (บาท/กก.)</h3>
              {Object.entries(typesMap).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                    <Badge className={`${v.color} border rounded-xl`} variant="secondary">{v.label}</Badge>
                  </div>
                  <Input type="number" step="0.5" min="0" value={costPerKg[k] || 0} onChange={(e) => setCostPerKg(prev => ({ ...prev, [k]: Number(e.target.value) }))} className="w-24 h-10 text-right rounded-2xl" />
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button className="h-12 rounded-2xl" onClick={() => saveWasteSettings.mutate()} disabled={saveWasteSettings.isPending}>
              {saveWasteSettings.isPending ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </Button>
          </div>

          <Card className="shadow-card border border-border/50 rounded-2xl">
            <CardContent className="p-5">
              <h3 className="text-base font-bold text-foreground mb-3">รายละเอียดค่าใช้จ่าย</h3>
              <div className="space-y-2">
                {Object.entries(typesMap).map(([k, v]) => {
                  const normalizedTypeKey = normalizeWasteType(k);
                  const typeWeight = combinedLogs.filter((l: any) => normalizeWasteType(l.waste_type) === normalizedTypeKey).reduce((s: number, l: any) => s + Number(l.weight), 0);
                  const typeCost = typeWeight * (costPerKg[k] || 0);
                  const pct = totalCost > 0 ? Math.round((typeCost / totalCost) * 100) : 0;
                  return (
                    <div key={k} className="space-y-1.5 py-2 border-b last:border-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                          <span className="text-base font-medium">{v.label}</span>
                        </div>
                        <span className="font-bold text-primary">{Math.round(typeCost * 100) / 100} ฿</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: v.chartColor }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-10 text-right">{pct}%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{Math.round(typeWeight * 100) / 100} กก. × {costPerKg[k]} ฿/กก.</p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      {/* Add waste form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className={cn("rounded-3xl", wasteType === "infectious" ? "max-w-3xl max-h-[90vh] overflow-y-auto" : "max-w-md")}>
          <DialogHeader><DialogTitle>บันทึกน้ำหนักขยะ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="font-semibold">แผนก</Label>
              <Select value={selectedDept} onValueChange={setSelectedDept}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ สามารถจัดการรายการแผนกได้</span>
                  <Button size="sm" variant="outline" className="h-10 rounded-2xl" onClick={() => setManageDeptsOpen(true)}>
                    จัดการ
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">ประเภทขยะ</Label>
              <Select value={wasteType} onValueChange={setWasteType}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(typesMap).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-3 h-3 rounded-full" style={{ background: v.chartColor }} />
                        <span>{v.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isAdmin && (
                <div className="flex items-center justify-between gap-2 pt-2">
                  <span className="text-xs text-muted-foreground">เฉพาะผู้ดูแลระบบ สามารถจัดการรายการประเภทขยะได้</span>
                  <Button size="sm" variant="outline" className="h-10 rounded-2xl" onClick={() => setManageTypesOpen(true)}>
                    จัดการ
                  </Button>
                </div>
              )}
            </div>
            {wasteType === "infectious" ? (
              <div className="space-y-4 rounded-2xl border border-red-100 bg-red-50/30 p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm font-semibold">วันที่รับขยะ *</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start", !infCollectionDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {infCollectionDate ? format(infCollectionDate, "d MMM yy", { locale: th }) : "เลือก"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]"><Calendar mode="single" selected={infCollectionDate} onSelect={setInfCollectionDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">วันที่ส่งต่อ ม.แม่ฟ้าหลวง</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start", !infTransferDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {infTransferDate ? format(infTransferDate, "d MMM yy", { locale: th }) : "เลือก"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[9999]"><Calendar mode="single" selected={infTransferDate} onSelect={setInfTransferDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                    </Popover>
                  </div>
                </div>
                <div className="space-y-3">
                  {infRows.map((row, i) => (
                    <Card key={i} className="rounded-2xl border bg-white">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-muted-foreground">รายการ #{i + 1}</span>
                          {infRows.length > 1 && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setInfRows(infRows.filter((_, idx) => idx !== i))}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <Select value={row.health_center_name} onValueChange={(v) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, health_center_name: v } : r))}>
                          <SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="เลือก รพ.สต./โรงพยาบาล" /></SelectTrigger>
                          <SelectContent>{HEALTH_CENTERS.map(hc => <SelectItem key={hc} value={hc}>{hc}</SelectItem>)}</SelectContent>
                        </Select>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                          <div>
                            <Label className="text-xs font-semibold">มีคม (กก.)</Label>
                            <Input type="number" step="0.1" min="0" value={row.sharp_waste_kg} onChange={(e) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, sharp_waste_kg: e.target.value } : r))} className="h-11 rounded-xl text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">ไม่มีคม (กก.)</Label>
                            <Input type="number" step="0.1" min="0" value={row.non_sharp_waste_kg} onChange={(e) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, non_sharp_waste_kg: e.target.value } : r))} className="h-11 rounded-xl text-sm" />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">ผู้นำส่ง</Label>
                            <Input value={row.delivered_by} onChange={(e) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, delivered_by: e.target.value } : r))} className="h-11 rounded-xl text-sm" placeholder="ชื่อ" />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <Label className="text-xs font-semibold">แหล่งที่มา</Label>
                            <Select value={row.source_type || ""} onValueChange={(v) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, source_type: v } : r))}>
                              <SelectTrigger className="h-11 rounded-xl text-sm"><SelectValue placeholder="เลือกแหล่งที่มา" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="รพ.มส.">รพ.มส.</SelectItem>
                                <SelectItem value="คลินิกเอกชน">คลินิกเอกชน</SelectItem>
                                <SelectItem value="อื่น ๆ">อื่น ๆ</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs font-semibold">ปริมาณขวด</Label>
                            <Input type="number" step="1" min="0" value={row.bottle_count || ""} onChange={(e) => setInfRows(infRows.map((r, idx) => idx === i ? { ...r, bottle_count: e.target.value } : r))} className="h-11 rounded-xl text-sm" placeholder="จำนวนขวด" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                  <Button variant="outline" className="w-full rounded-2xl h-11 text-sm" onClick={() => setInfRows([...infRows, emptyInfRow()])}>
                    <Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ
                  </Button>
                </div>
                <div className="rounded-xl bg-white border border-red-200 p-3 text-sm flex items-center justify-between">
                  <span className="text-slate-600">น้ำหนักรวมขยะติดเชื้อ</span>
                  <span className="font-bold text-red-700">
                    {infRows.reduce((s, r) => s + (parseFloat(r.sharp_waste_kg) || 0) + (parseFloat(r.non_sharp_waste_kg) || 0), 0).toFixed(1)} กก.
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="font-semibold">น้ำหนัก (กก.)</Label>
                <Input type="number" step="0.1" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.0" className="text-lg h-12 rounded-2xl" />
              </div>
            )}
            {isAdmin && (
              <div className="space-y-3 rounded-2xl bg-blue-50/50 p-4 border border-blue-100">
                <p className="text-xs font-bold text-blue-700">⚙ ตัวเลือกผู้ดูแล (ลงข้อมูลย้อนหลัง)</p>
                <div className="space-y-1">
                  <Label className="text-xs">วัน/เดือน/ปี และเวลา (เว้นว่าง = ใช้เวลาปัจจุบัน)</Label>
                  <Input type="datetime-local" value={customDateTime} onChange={(e) => setCustomDateTime(e.target.value)} className="h-11 rounded-2xl" />
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label className="font-semibold">ผู้บันทึก</Label>
              <Input
                value={profile?.full_name || user?.email || "ผู้ใช้งาน"}
                readOnly
                disabled
                className="h-11 rounded-2xl bg-slate-100 text-slate-700"
              />
            </div>
            <Button className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-600 hover:to-teal-600 shadow-lg" onClick={() => createLog.mutate()} disabled={createLog.isPending || (wasteType !== "infectious" && !weight)}>
              {createLog.isPending ? "กำลังบันทึก..." : (wasteType === "infectious" ? "บันทึกทั้งหมด" : "บันทึก")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>รายละเอียดบันทึกขยะ</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-3 text-base">
                  <div className="flex justify-between"><span className="text-muted-foreground">ประเภท:</span>{(() => {
                    const wt = getWasteTypeMeta(selectedLog.waste_type);
                    return <Badge className={`${wt.color} border`} variant="secondary">{wt.label}</Badge>;
                  })()}</div>
                  <div className="flex justify-between"><span className="text-muted-foreground">น้ำหนัก:</span><span className="font-bold text-foreground">{selectedLog.weight} กก.</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">แผนก:</span><span className="text-foreground">{selectedLog.departments?.name || "-"}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">วันที่:</span><span className="text-foreground">{new Date(selectedLog.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={manageDeptsOpen} onOpenChange={setManageDeptsOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>จัดการแผนก</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {departments.map((dept: any) => (
                <div key={dept.id} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{dept.name}</p>
                  </div>
                  <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => { setDeptEditId(dept.id); setDeptEditName(dept.name); }}>
                    แก้ไข
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-2xl text-destructive" onClick={() => deleteDepartment.mutate(dept.id)}>
                    ลบ
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-3 p-4 rounded-3xl border border-border/70 bg-slate-50">
              <Label className="text-sm font-semibold">เพิ่ม / แก้ไขแผนก</Label>
              <Input placeholder="ชื่อแผนก" value={deptEditName} onChange={(e) => setDeptEditName(e.target.value)} className="h-12 rounded-2xl" />
              <div className="flex gap-2 flex-wrap">
                <Button className="h-12 rounded-2xl" onClick={() => saveDepartment.mutate({ id: deptEditId, name: deptEditName })} disabled={saveDepartment.isPending || !deptEditName.trim()}>
                  {saveDepartment.isPending ? "กำลังบันทึก..." : deptEditId ? "อัปเดต" : "เพิ่ม"}
                </Button>
                {deptEditId && (
                  <Button variant="ghost" className="h-12 rounded-2xl" onClick={() => { setDeptEditId(null); setDeptEditName(""); }}>
                    ยกเลิก
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={manageTypesOpen} onOpenChange={setManageTypesOpen}>
        <DialogContent className="max-w-2xl rounded-3xl">
          <DialogHeader><DialogTitle>จัดการประเภทขยะ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              {Object.entries(typesMap).map(([key, value]) => (
                <div key={key} className="flex flex-col gap-2 rounded-3xl border border-border/50 p-3 bg-slate-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-3 h-3 rounded-full" style={{ background: value.chartColor }} />
                      <span className="font-medium">{key}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      const copy = { ...typesMap };
                      delete copy[key];
                      setTypesMap(copy);
                    }}>
                      ลบ
                    </Button>
                  </div>
                  <Input value={value.label} onChange={(e) => setTypesMap(prev => ({ ...prev, [key]: { ...prev[key], label: e.target.value } }))} className="h-12 rounded-2xl" />
                </div>
              ))}
            </div>
            <div className="space-y-3 p-4 rounded-3xl border border-border/70 bg-slate-50">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="คีย์ใหม่ เช่น special" value={newTypeKey} onChange={(e) => setNewTypeKey(e.target.value)} className="h-12 rounded-2xl" />
                <Input placeholder="ป้ายชื่อใหม่" value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} className="h-12 rounded-2xl" />
              </div>
              <Button className="h-12 rounded-2xl" onClick={() => {
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
