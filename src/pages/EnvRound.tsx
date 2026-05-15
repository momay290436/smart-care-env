import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportExcel";
import { createAutoIssue, getIssueSeverity, hasEnvRoundAnomaly } from "@/lib/createAutoIssue";
import PageHeader from "@/components/PageHeader";
import EnvRoundCalendar from "@/components/EnvRoundCalendar";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Download, Camera, ChevronLeft, ChevronRight, Send, Wrench } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const CATEGORIES = [
  { key: "physical_safety", label: "ความปลอดภัยกายภาพ", color: "text-blue-600", items: ["สภาพพื้น", "เพดาน", "แสงสว่าง", "ทางหนีไฟ", "ป้ายบอกทาง", "ราวจับ/ราวกันตก"] },
  { key: "fire_safety", label: "ระบบอัคคีภัย", color: "text-red-600", items: ["ถังดับเพลิง", "ระบบแจ้งเหตุเพลิงไหม้", "สายฉีดน้ำดับเพลิง", "ป้าย EXIT", "แผนผังหนีไฟ"] },
  { key: "waste_chemical", label: "การจัดการขยะ/สารเคมี", color: "text-amber-600", items: ["ถังขยะติดเชื้อ", "ถังขยะทั่วไป", "ถังขยะรีไซเคิล", "ตู้เก็บสารเคมี", "MSDS", "ถังขยะอันตราย"] },
  { key: "utilities", label: "ระบบสาธารณูปโภค", color: "text-green-600", items: ["ปลั๊กไฟ/สายไฟ", "ระบบประปา", "ก๊าซทางการแพทย์", "ระบบปรับอากาศ", "ระบบสื่อสาร"] },
];

type RoundItemInput = {
  category: string; item_name: string; result: "normal" | "abnormal" | "na";
  severity?: "low" | "medium" | "high"; photo_url?: string; notes?: string;
};

function QrScannerSection({ onResult }: { onResult: (data: string) => void }) {
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    if (!showScanner) return;
    const scanner = new Html5QrcodeScanner("qr-reader-env", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render(
      (text) => { onResult(text); scanner.clear(); setShowScanner(false); },
      () => {}
    );
    return () => { try { scanner.clear(); } catch {} };
  }, [showScanner]);

  return (
    <>
      <Button variant="outline" className="w-full h-13 rounded-2xl text-base gap-2" onClick={() => setShowScanner(!showScanner)}>
        <Camera className="h-5 w-5" />
        {showScanner ? "ปิดกล้อง" : "สแกน QR Code ประจำจุด"}
      </Button>
      {showScanner && <div id="qr-reader-env" className="w-full rounded-2xl overflow-hidden" />}
    </>
  );
}

export default function EnvRound() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeRound, setActiveRound] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState("");
  const [items, setItems] = useState<RoundItemInput[]>([]);
  const [currentCategory, setCurrentCategory] = useState(0);
  const [uploadingItem, setUploadingItem] = useState<number | null>(null);
  const [selectedRound, setSelectedRound] = useState<any>(null);
  const [roundItems, setRoundItems] = useState<any[]>([]);
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [issueDialog, setIssueDialog] = useState<any>(null);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueSaving, setIssueSaving] = useState(false);

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => { const { data } = await supabase.from("departments").select("*").order("name"); return data || []; },
  });

  const { data: allRoundItems = [] } = useQuery({
    queryKey: ["env_round_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("env_round_items").select("*");
      if (error) { console.error("env_round_items error", error); return []; }
      return data || [];
    },
  });

  const { data: rounds = [] } = useQuery({
    queryKey: ["env_rounds"],
    queryFn: async () => {
      const { data, error } = await supabase.from("env_rounds").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) { console.error("env_rounds error", error); return []; }
      if (!data || data.length === 0) return [];
      // Manually join department names
      const deptIds = [...new Set(data.filter((r: any) => r.department_id).map((r: any) => r.department_id))];
      let deptMap: Record<string, string> = {};
      if (deptIds.length > 0) {
        const { data: depts } = await supabase.from("departments").select("id, name").in("id", deptIds);
        deptMap = Object.fromEntries((depts || []).map((d: any) => [d.id, d.name]));
      }
      return data.map((r: any) => ({ ...r, departments: r.department_id ? { name: deptMap[r.department_id] || "ไม่ระบุ" } : { name: "ไม่ระบุแผนก" } }));
    },
  });

  const filteredRounds = useMemo(() => {
    return rounds.filter((r: any) => {
      const created = new Date(r.created_at);
      const now = new Date();
      if (filterPeriod === "day" && created < startOfDay(now)) return false;
      if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
      if (filterPeriod === "month" && created < startOfMonth(now)) return false;
      if (filterPeriod === "custom" && customFrom && customTo) {
        if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
      }
      return true;
    });
  }, [rounds, filterPeriod, customFrom, customTo]);

  const initItems = () => {
    const allItems: RoundItemInput[] = [];
    CATEGORIES.forEach((cat) => { cat.items.forEach((item) => { allItems.push({ category: cat.key, item_name: item, result: "normal" }); }); });
    setItems(allItems);
    setCurrentCategory(0);
  };

  const handleQrResult = (data: string) => {
    const dept = departments.find(d => d.id === data || d.name === data);
    if (dept) { setSelectedDept(dept.id); toast.success(`เลือกแผนก: ${dept.name}`); }
    else { toast.info(`QR: ${data}`); setSelectedDept(data); }
  };

  const startRoundMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("env_rounds").insert({
        department_id: selectedDept || null, inspector_id: user!.id,
        inspector_name: profile?.full_name || "", status: "in_progress",
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => { setActiveRound(data.id); initItems(); toast.success("เริ่มการตรวจแล้ว"); },
    onError: (e: any) => toast.error(e.message),
  });

  const completeRoundMutation = useMutation({
    mutationFn: async () => {
      const { error: itemsError } = await supabase.from("env_round_items").insert(
        items.map((item) => ({
          round_id: activeRound!, category: item.category, item_name: item.item_name,
          result: item.result, severity: item.result === "abnormal" ? (item.severity || "low") : null,
          photo_url: item.photo_url || null, notes: item.notes || null,
        }))
      );
      if (itemsError) throw itemsError;
      const { error: roundError } = await supabase.from("env_rounds").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", activeRound!);
      if (roundError) throw roundError;
      const abnormalItems = items.filter((i) => i.result === "abnormal");
      for (const item of abnormalItems) {
        await supabase.from("maintenance_tickets").insert({
          title: `[ENV Round] ${item.item_name} ผิดปกติ`,
          description: `พบปัญหา: ${item.item_name}\nระดับความรุนแรง: ${item.severity || "low"}\n${item.notes || ""}`,
          department_id: selectedDept || departments[0]?.id, created_by: user!.id,
          priority: item.severity === "high" ? "urgent" : item.severity === "medium" ? "high" : "normal",
          photo_url: item.photo_url || null,
        });
        if (hasEnvRoundAnomaly(item.result)) {
          await createAutoIssue({
            sourceModule: "EnvRound",
            sourceId: activeRound || null,
            title: `[ENV Round] ${item.item_name} ผิดปกติ`,
            description: `ระดับความรุนแรง: ${item.severity || "low"}\n${item.notes || ""}` + (item.photo_url ? `\nรูปภาพ: ${item.photo_url}` : ""),
            severity: getIssueSeverity("EnvRound", { details: item }),
            department: departments.find((d) => d.id === selectedDept)?.name || undefined,
            createdBy: user!.id,
          });
        }
      }
      const deptName = departments.find((d) => d.id === selectedDept)?.name || "ไม่ระบุ";
      const highRisk = abnormalItems.filter((i) => i.severity === "high").length;
      const normalCount = items.filter((i) => i.result === "normal").length;
      // Sync to Google Sheets
      try {
        await supabase.functions.invoke("sync-google-sheets", {
          body: {
            type: "env",
            data: {
              department: deptName, inspector: profile?.full_name || "",
              date: new Date().toLocaleDateString("th-TH"),
              items: items.map(i => ({ category: i.category, item_name: i.item_name, result: i.result, severity: i.severity, notes: i.notes, photo_url: i.photo_url })),
              summary: { normal: normalCount, abnormal: abnormalItems.length, highRisk },
            },
          },
        });
      } catch {}
      // Upload photos to Google Drive
      try {
        for (const item of items.filter(i => i.photo_url)) {
          await supabase.functions.invoke("upload-google-drive", { body: { imageUrl: item.photo_url, fileName: `ENV_${deptName}_${item.item_name}_${Date.now()}.jpg`, subFolder: "ENV Round Photos" } });
        }
      } catch {}
      try {
        await supabase.functions.invoke("line-notify", {
          body: { message: `สรุป ENV Round\nแผนก: ${deptName}\nผู้ตรวจ: ${profile?.full_name}\nปกติ: ${normalCount} จุด\nผิดปกติ: ${abnormalItems.length} จุด${highRisk > 0 ? `\nระดับสูง: ${highRisk} จุด` : ""}` },
        });
      } catch {}
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["env_rounds"] });
      setActiveRound(null); setItems([]);
      toast.success("บันทึกผลการตรวจเรียบร้อย");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadPhoto = async (index: number, file: File) => {
    setUploadingItem(index);
    const filePath = `env-round/${activeRound}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("photos").upload(filePath, file);
    if (error) { toast.error("อัปโหลดไม่สำเร็จ"); setUploadingItem(null); return; }
    const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath);
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, photo_url: publicUrl } : item));
    setUploadingItem(null);
    toast.success("อัปโหลดรูปสำเร็จ");
  };

  const updateItem = (index: number, updates: Partial<RoundItemInput>) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const viewRoundDetails = async (round: any) => {
    setSelectedRound(round);
    const { data } = await supabase.from("env_round_items").select("*").eq("round_id", round.id).order("category");
    setRoundItems(data || []);
  };

  const deleteRound = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("env_round_items").delete().eq("round_id", id);
      const { error } = await supabase.from("env_rounds").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["env_rounds"] }); setSelectedRound(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const currentCatItems = useMemo(() => {
    if (!CATEGORIES[currentCategory]) return [];
    return items.map((item, idx) => ({ ...item, globalIndex: idx })).filter((item) => item.category === CATEGORIES[currentCategory].key);
  }, [items, currentCategory]);

  const abnormalCount = items.filter((i) => i.result === "abnormal").length;

  if (!activeRound) {
    return (
      <div className="space-y-5 pb-6">
        <PageHeader title="Smart ENV Round" subtitle="ระบบเดินตรวจสิ่งแวดล้อมและความปลอดภัย">
          <Button size="sm" variant="outline" className="rounded-2xl text-sm h-9 gap-1.5" onClick={() => {
            exportToExcel(filteredRounds.map((r: any) => ({
              "วันที่": format(new Date(r.created_at), "d MMM yyyy HH:mm", { locale: th }),
              "แผนก": r.departments?.name || "ไม่ระบุ", "ผู้ตรวจ": r.inspector_name,
              "สถานะ": r.status === "completed" ? "เสร็จสิ้น" : "กำลังตรวจ",
            })), "env-rounds", "ENV Round");
            toast.success("ส่งออก Excel สำเร็จ");
          }}>
            <Download className="h-4 w-4" /> Excel
          </Button>
        </PageHeader>

        {/* 60/40 Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3">
            <EnvRoundCalendar />
          </div>
          <div className="lg:col-span-2 space-y-4">
            <Card className="border border-slate-200 shadow-lg bg-white animate-fade-in rounded-2xl">
              <CardContent className="p-5 space-y-4">
                <h2 className="font-bold text-lg text-foreground">เริ่มเดินตรวจใหม่</h2>
                <QrScannerSection onResult={handleQrResult} />
                <div>
                  <Label className="text-sm">เลือกแผนก / พื้นที่</Label>
                  <Select value={selectedDept} onValueChange={setSelectedDept}>
                    <SelectTrigger className="h-13 text-base rounded-2xl"><SelectValue placeholder="เลือกแผนก..." /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full h-14 text-base gap-2 rounded-2xl shadow-card" onClick={() => startRoundMutation.mutate()} disabled={!selectedDept || startRoundMutation.isPending}>
                  {startRoundMutation.isPending ? "กำลังเริ่ม..." : "เริ่มเดินตรวจ"}
                </Button>
              </CardContent>
            </Card>
            <Card className="border border-slate-200 shadow-lg rounded-2xl bg-white">
              <CardContent className="p-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-medium text-foreground">กรอง:</span>
                  <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                    <SelectTrigger className="h-10 text-sm w-32 rounded-2xl"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-2xl">
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="day">วันนี้</SelectItem>
                      <SelectItem value="week">สัปดาห์นี้</SelectItem>
                      <SelectItem value="month">เดือนนี้</SelectItem>
                      <SelectItem value="custom">เลือกวันที่</SelectItem>
                    </SelectContent>
                  </Select>
                  <Badge variant="secondary" className="h-10 px-4 flex items-center text-sm rounded-2xl">{filteredRounds.length} รายการ</Badge>
                </div>
                {filterPeriod === "custom" && (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: customFrom, set: setCustomFrom, placeholder: "วันเริ่มต้น" },
                      { val: customTo, set: setCustomTo, placeholder: "วันสิ้นสุด" },
                    ].map((cfg, i) => (
                      <Popover key={i}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl", !cfg.val && "text-slate-500")}>
                            {cfg.val ? format(cfg.val, "d MMM yy", { locale: th }) : cfg.placeholder}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar mode="single" selected={cfg.val} onSelect={cfg.set} disabled={(d) => d > new Date() || (i === 1 && customFrom ? d < customFrom : false)} initialFocus className="p-3 pointer-events-auto" />
                        </PopoverContent>
                      </Popover>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <h3 className="font-bold text-base text-foreground">ประวัติการตรวจ</h3>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {filteredRounds.map((round: any, idx: number) => {
                const abnormalCount = allRoundItems.filter((i: any) => i.round_id === round.id && i.result === "abnormal").length;
                return (
                <Card key={round.id} className="border-0 shadow-card cursor-pointer hover:shadow-elevated transition-all animate-slide-up rounded-2xl bg-white/80 backdrop-blur-sm hover:-translate-y-0.5" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => viewRoundDetails(round)}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold text-foreground">{round.departments?.name || "ไม่ระบุแผนก"}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(round.created_at), "d MMM yyyy HH:mm", { locale: th })}
                        {" · "}{round.inspector_name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={round.status === "completed" ? "default" : "secondary"} className="rounded-2xl text-sm">
                          {round.status === "completed" ? "เสร็จสิ้น" : "กำลังตรวจ"}
                        </Badge>
                        {round.status === "completed" && abnormalCount > 0 && (
                          <div className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-lg font-semibold flex items-center gap-1">
                            <span className="text-lg">⚠️</span> พบปัญหา ({abnormalCount})
                          </div>
                        )}
                      </div>
                      {isAdmin && (
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive rounded-2xl" onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(round.id); }}>✕</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
              {filteredRounds.length === 0 && <p className="text-center text-muted-foreground py-8 text-base">ไม่มีประวัติการตรวจ</p>}
            </div>
          </div>
        </div>

        {/* Round detail dialog */}
        <Dialog open={!!selectedRound} onOpenChange={() => setSelectedRound(null)}>
          <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
            <DialogHeader><DialogTitle className="text-lg">รายละเอียดการตรวจ</DialogTitle></DialogHeader>
            {selectedRound && (
              <div className="space-y-4">
                <div className="text-base space-y-1.5 rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                  <p><span className="text-muted-foreground">แผนก:</span> {selectedRound.departments?.name || "-"}</p>
                  <p><span className="text-muted-foreground">ผู้ตรวจ:</span> {selectedRound.inspector_name}</p>
                  <p><span className="text-muted-foreground">วันที่:</span> {format(new Date(selectedRound.created_at), "d MMMM yyyy HH:mm น.", { locale: th })}</p>
                </div>
                {/* Split normal / abnormal */}
                {(() => {
                  const normalItems = roundItems.filter(i => i.result !== "abnormal");
                  const abnormalItems = roundItems.filter(i => i.result === "abnormal");
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Normal items - left */}
                      <div>
                        <h4 className="text-sm font-bold text-emerald-700 mb-2 flex items-center gap-1">✅ ปกติ ({normalItems.length})</h4>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {normalItems.map((item: any) => (
                            <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl text-sm bg-emerald-50 border border-emerald-200">
                              <span className="text-emerald-800">{item.item_name}</span>
                              <Badge className="bg-emerald-100 text-emerald-700 text-[10px] rounded-lg border-emerald-200" variant="outline">ปกติ</Badge>
                            </div>
                          ))}
                          {normalItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">ไม่มี</p>}
                        </div>
                      </div>
                      {/* Abnormal items - right */}
                      <div>
                        <h4 className="text-sm font-bold text-red-700 mb-2 flex items-center gap-1">⚠️ ผิดปกติ ({abnormalItems.length})</h4>
                        <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                          {abnormalItems.map((item: any) => (
                            <div key={item.id} className="p-2.5 rounded-xl text-sm bg-red-50 border border-red-200 space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-red-800 font-medium">{item.item_name}</span>
                                <Badge variant="destructive" className="text-[10px] rounded-lg">
                                  {item.severity === "high" ? "สูง" : item.severity === "medium" ? "กลาง" : "ต่ำ"}
                                </Badge>
                              </div>
                              {item.notes && <p className="text-xs text-red-600">{item.notes}</p>}
                              {item.photo_url && <img src={item.photo_url} alt="" className="h-16 w-full rounded-lg object-cover" />}
                              <Button size="sm" variant="outline" className="w-full h-8 text-xs rounded-lg border-red-300 text-red-700 hover:bg-red-100 gap-1" onClick={() => { setIssueDialog(item); setIssueNotes(""); }}>
                                <Wrench className="h-3 w-3" /> จัดการปัญหา
                              </Button>
                            </div>
                          ))}
                          {abnormalItems.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">ไม่มี</p>}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <Button variant="outline" className="w-full rounded-2xl h-11 gap-1.5" onClick={() => {
                  exportToExcel(roundItems.map((i: any) => ({
                    "หมวดหมู่": CATEGORIES.find(c => c.key === i.category)?.label || i.category,
                    "รายการ": i.item_name,
                    "ผลลัพธ์": i.result === "normal" ? "ปกติ" : i.result === "abnormal" ? "ผิดปกติ" : "N/A",
                    "ความรุนแรง": i.severity || "-", "หมายเหตุ": i.notes || "-",
                  })), `env-round-${selectedRound.id.slice(0, 8)}`, "ผลการตรวจ");
                  toast.success("ส่งออก Excel สำเร็จ");
                }}>
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Issue resolution dialog */}
        <Dialog open={!!issueDialog} onOpenChange={(o) => !o && setIssueDialog(null)}>
          <DialogContent className="rounded-3xl max-w-md">
            <DialogHeader><DialogTitle>จัดการปัญหา</DialogTitle></DialogHeader>
            {issueDialog && (
              <div className="space-y-4">
                <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-1">
                  <p className="text-sm font-bold text-red-800">{issueDialog.item_name}</p>
                  <p className="text-xs text-red-600">หมวด: {CATEGORIES.find(c => c.key === issueDialog.category)?.label || issueDialog.category}</p>
                  {issueDialog.notes && <p className="text-xs text-red-600">หมายเหตุ: {issueDialog.notes}</p>}
                  <Badge variant="destructive" className="text-[10px] rounded-lg mt-1">
                    ความรุนแรง: {issueDialog.severity === "high" ? "สูง" : issueDialog.severity === "medium" ? "กลาง" : "ต่ำ"}
                  </Badge>
                </div>
                {issueDialog.photo_url && <img src={issueDialog.photo_url} alt="" className="rounded-2xl w-full max-h-40 object-cover" />}
                <div>
                  <Label className="text-sm font-semibold">วิธีการจัดการ/แก้ไขปัญหา</Label>
                  <Textarea value={issueNotes} onChange={(e) => setIssueNotes(e.target.value)} placeholder="ระบุวิธีการแก้ไขปัญหา..." rows={3} className="rounded-2xl mt-1" />
                </div>
                <Button className="w-full h-12 rounded-2xl font-bold" disabled={!issueNotes.trim() || issueSaving} onClick={async () => {
                  setIssueSaving(true);
                  const { error } = await supabase.from("issues").insert({
                    title: `[ENV Round] ${issueDialog.item_name} ผิดปกติ`,
                    description: `หมวด: ${CATEGORIES.find(c => c.key === issueDialog.category)?.label || issueDialog.category}\n${issueDialog.notes || ""}`,
                    source_module: "env_round", source_id: issueDialog.round_id,
                    severity: issueDialog.severity || "medium", status: "pending",
                    resolution_notes: issueNotes,
                    photo_url: issueDialog.photo_url || null,
                    department_name: selectedRound?.departments?.name || null,
                    created_by: user?.id,
                  });
                  setIssueSaving(false);
                  if (error) { toast.error(error.message); return; }
                  toast.success("บันทึกการจัดการปัญหาสำเร็จ");
                  setIssueDialog(null);
                  queryClient.invalidateQueries({ queryKey: ["issues"] });
                }}>
                  {issueSaving ? "กำลังบันทึก..." : "บันทึกการจัดการปัญหา"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <ConfirmDialog
          open={!!deleteConfirmId}
          onOpenChange={(open) => !open && setDeleteConfirmId(null)}
          title="ยืนยันลบข้อมูล"
          description="ต้องการลบประวัติการตรวจนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้"
          confirmLabel="ลบ"
          onConfirm={() => { if (deleteConfirmId) { deleteRound.mutate(deleteConfirmId); setDeleteConfirmId(null); } }}
        />
      </div>
    );
  }

  // Active round - show checklist
  const cat = CATEGORIES[currentCategory];

  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-center gap-2">
        {CATEGORIES.map((c, i) => (
          <button key={c.key} onClick={() => setCurrentCategory(i)}
            className={`flex-1 h-2.5 rounded-full transition-colors ${i === currentCategory ? "bg-primary" : i < currentCategory ? "bg-primary/50" : "bg-muted"}`}
          />
        ))}
      </div>

      <Card className="border border-emerald-200 shadow-lg bg-white animate-fade-in rounded-2xl">
        <CardContent className="p-5">
          <h2 className="font-bold text-lg text-foreground">{cat.label}</h2>
          <p className="text-sm text-muted-foreground">หมวดที่ {currentCategory + 1} จาก {CATEGORIES.length}</p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {currentCatItems.map((item) => (
          <Card key={item.globalIndex} className={`border border-slate-200 shadow-lg rounded-2xl ${item.result === "abnormal" ? "bg-red-50 border-red-200" : "bg-white"} animate-fade-in`}>
            <CardContent className="p-4 space-y-3">
              <span className="text-base font-semibold text-foreground">{item.item_name}</span>
              <div className="grid grid-cols-3 gap-2">
                <Button variant={item.result === "normal" ? "default" : "outline"}
                  className={`h-12 text-sm rounded-2xl ${item.result === "normal" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                  onClick={() => updateItem(item.globalIndex, { result: "normal", severity: undefined, photo_url: undefined, notes: undefined })}>
                  ปกติ
                </Button>
                <Button variant={item.result === "abnormal" ? "destructive" : "outline"} className="h-12 text-sm rounded-2xl"
                  onClick={() => updateItem(item.globalIndex, { result: "abnormal", severity: "low" })}>
                  ผิดปกติ
                </Button>
                <Button variant={item.result === "na" ? "secondary" : "outline"} className="h-12 text-sm rounded-2xl"
                  onClick={() => updateItem(item.globalIndex, { result: "na", severity: undefined, photo_url: undefined, notes: undefined })}>
                  N/A
                </Button>
              </div>
              {item.result === "abnormal" && (
                <div className="space-y-3 border-t pt-3">
                  <div>
                    <Label className="text-sm">ระดับความรุนแรง</Label>
                    <div className="grid grid-cols-3 gap-2 mt-1.5">
                      {(["low", "medium", "high"] as const).map((sev) => (
                        <Button key={sev} size="sm" variant={item.severity === sev ? "default" : "outline"}
                          className={`h-11 text-sm rounded-2xl ${item.severity === sev ? (sev === "high" ? "bg-red-600 hover:bg-red-700" : sev === "medium" ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-500 hover:bg-blue-600") : ""}`}
                          onClick={() => updateItem(item.globalIndex, { severity: sev })}>
                          {sev === "low" ? "ต่ำ" : sev === "medium" ? "กลาง" : "สูง"}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm">หมายเหตุ</Label>
                    <Input value={item.notes || ""} onChange={(e) => updateItem(item.globalIndex, { notes: e.target.value })} placeholder="รายละเอียดปัญหา..." className="h-11 rounded-2xl" />
                  </div>
                  <div>
                    <Label className="text-sm">รูปภาพหลักฐาน (จำเป็น)</Label>
                    {item.photo_url ? (
                      <div className="mt-1.5 relative">
                        <img src={item.photo_url} alt="evidence" className="h-28 w-full rounded-2xl object-cover" />
                        <Badge className="absolute top-2 right-2 text-xs bg-emerald-600 rounded-2xl">อัปโหลดแล้ว</Badge>
                      </div>
                    ) : (
                      <label className="mt-1.5 flex h-20 w-full cursor-pointer items-center justify-center rounded-2xl border-2 border-dashed border-muted-foreground/30 hover:bg-muted/50">
                        {uploadingItem === item.globalIndex ? (
                          <span className="text-sm text-muted-foreground">กำลังอัปโหลด...</span>
                        ) : (
                          <span className="text-base text-muted-foreground flex items-center gap-2"><Camera className="h-5 w-5" /> ถ่ายรูป / เลือกไฟล์</span>
                        )}
                        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadPhoto(item.globalIndex, file);
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-3">
        {currentCategory > 0 && (
          <Button variant="outline" className="flex-1 h-13 rounded-2xl gap-1.5 text-base" onClick={() => setCurrentCategory((p) => p - 1)}>
            <ChevronLeft className="h-5 w-5" /> ก่อนหน้า
          </Button>
        )}
        {currentCategory < CATEGORIES.length - 1 ? (
          <Button className="flex-1 h-13 rounded-2xl gap-1.5 text-base" onClick={() => setCurrentCategory((p) => p + 1)}>
            ถัดไป <ChevronRight className="h-5 w-5" />
          </Button>
        ) : (
          <Button className="flex-1 h-13 bg-emerald-600 hover:bg-emerald-700 rounded-2xl gap-1.5 text-base" onClick={() => {
            const abnormalWithoutPhoto = items.filter((i) => i.result === "abnormal" && !i.photo_url);
            if (abnormalWithoutPhoto.length > 0) { toast.error(`กรุณาอัปโหลดรูปสำหรับจุดผิดปกติ ${abnormalWithoutPhoto.length} รายการ`); return; }
            completeRoundMutation.mutate();
          }} disabled={completeRoundMutation.isPending}>
            <Send className="h-5 w-5" />
            {completeRoundMutation.isPending ? "กำลังบันทึก..." : `ส่งผลการตรวจ (พบปัญหา ${abnormalCount} จุด)`}
          </Button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 flex items-center justify-around text-base z-40 shadow-elevated">
        <span className="text-emerald-600 font-semibold">ปกติ {items.filter((i) => i.result === "normal").length}</span>
        <span className="text-red-600 font-semibold">ผิดปกติ {abnormalCount}</span>
        <span className="text-muted-foreground">N/A {items.filter((i) => i.result === "na").length}</span>
      </div>
    </div>
  );
}
