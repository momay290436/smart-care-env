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
import { Check, ChevronsUpDown } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
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

  const { data: locations } = useQuery({
    queryKey: ["fire-locations"],
    queryFn: async () => { const { data } = await supabase.from("fire_extinguisher_locations").select("*").order("name"); return data || []; },
  });

  const selectedLocation = useMemo(() => locations?.find((l) => l.id === locationId), [locations, locationId]);

  const { data: checks } = useQuery({
    queryKey: ["fire-checks"],
    queryFn: async () => {
      const { data } = await supabase.from("fire_extinguisher_checks").select("*, departments(name)").order("checked_at", { ascending: false }).limit(30);
      if (!data) return [];
      const locIds = [...new Set(data.map((c: any) => c.location))];
      const { data: locs } = await supabase.from("fire_extinguisher_locations").select("id, name").in("id", locIds);
      const locMap = Object.fromEntries((locs || []).map((l) => [l.id, l.name]));
      return data.map((c: any) => ({ ...c, location_name: locMap[c.location] || c.location }));
    },
  });

  const allOkInspection = (d: InspectionDetails) => Object.values(d).every(Boolean);

  const createCheck = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("ไม่ได้เข้าสู่ระบบ");
      const pressureOk = inspection.gauge_green;
      const conditionOk = inspection.body_ok && inspection.hose_ok && inspection.handle_ok;
      const { error } = await supabase.from("fire_extinguisher_checks").insert({
        location: locationId, pressure_ok: pressureOk, condition_ok: conditionOk,
        notes: notes || null, department_id: profile?.department_id, checked_by: user.id,
        inspection_details: inspection as any, inspector_name: profile?.full_name || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกการตรวจถังดับเพลิงสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["fire-checks"] });
      queryClient.invalidateQueries({ queryKey: ["fire-checks-summary"] });
      setShowForm(false); setLocationId(""); setNotes(""); setInspection({ ...defaultInspection });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleItem = (key: keyof InspectionDetails) => { setInspection((prev) => ({ ...prev, [key]: !prev[key] })); };

  const groups = inspectionItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, typeof inspectionItems>);

  const groupIcons: Record<string, string> = { "สภาพภายนอก": "1", "มาตรวัดความดัน": "2", "อุปกรณ์นิรภัย": "3" };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="ตรวจถังดับเพลิง" subtitle="บันทึกและตรวจสอบสภาพถังดับเพลิง" gradient="from-primary/10 to-accent/40">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 border-primary/30 text-primary" onClick={() => {
          const filtered = checks?.filter((c: any) => {
            const details: InspectionDetails | null = c.inspection_details;
            const allOk = details ? allOkInspection(details) : (c.pressure_ok && c.condition_ok);
            if (filterResult === "ok" && !allOk) return false;
            if (filterResult === "fail" && allOk) return false;
            return true;
          }) || [];
          exportToExcel(filtered.map((c: any) => {
            const details: InspectionDetails | null = c.inspection_details;
            const allOk = details ? allOkInspection(details) : (c.pressure_ok && c.condition_ok);
            return {
              "วันที่ตรวจ": new Date(c.checked_at).toLocaleDateString("th-TH"),
              "ตำแหน่ง": c.location_name || c.location, "ผู้ตรวจ": c.inspector_name || "-",
              "ผลตรวจ": allOk ? "ปกติ" : "พบปัญหา",
            };
          }), "fire-check", "ตรวจถังดับเพลิง");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>Excel</Button>
        <Button size="sm" className="rounded-2xl h-9" onClick={() => setShowForm(!showForm)}>
          {showForm ? "ซ่อน" : "+ สแกน QR ตรวจ"}
        </Button>
      </PageHeader>

      {showForm && (
        <div className="space-y-4 animate-slide-up">
          {/* QR Scanner for location */}
          <Card className="border border-border/50 shadow-elevated rounded-2xl">
            <CardContent className="pt-5 space-y-3">
              <Label className="font-bold text-base">สแกน QR Code ถังดับเพลิง</Label>
              {!locationId ? (
                <>
                  <QrScannerSection onResult={(data) => {
                    const loc = locations?.find((l) => l.id === data || l.qr_code_data === data);
                    if (loc) { setLocationId(loc.id); toast.success(`เลือกตำแหน่ง: ${loc.name}`); }
                    else toast.error("ไม่พบถังดับเพลิงในระบบ");
                  }} />
                  <div className="relative my-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                    <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">หรือค้นหาด้วยตนเอง</span></div>
                  </div>
                  <Popover open={locationOpen} onOpenChange={setLocationOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-12 rounded-2xl">
                        {selectedLocation ? selectedLocation.name : "ค้นหาตำแหน่ง..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="พิมพ์ค้นหาตำแหน่ง..." />
                        <CommandList>
                          <CommandEmpty>ไม่พบตำแหน่ง</CommandEmpty>
                          <CommandGroup>
                            {locations?.map((loc) => (
                              <CommandItem key={loc.id} value={loc.name} onSelect={() => { setLocationId(loc.id); setLocationOpen(false); }}>
                                <Check className={`mr-2 h-4 w-4 ${locationId === loc.id ? "opacity-100" : "opacity-0"}`} />
                                <div>
                                  <p className="text-sm">{loc.name}</p>
                                  {loc.floor && <p className="text-xs text-muted-foreground">{loc.building} - {loc.floor}</p>}
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </>
              ) : (
                <div className="flex items-center justify-between rounded-2xl bg-primary/10 p-4">
                  <div>
                    <p className="font-semibold text-foreground">{selectedLocation?.name}</p>
                    {selectedLocation?.building && <p className="text-sm text-muted-foreground">{selectedLocation.building} - {selectedLocation.floor}</p>}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-2xl" onClick={() => setLocationId("")}>เปลี่ยน</Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Inspector - Auto filled */}
          <Card className="border border-border/50 shadow-elevated rounded-2xl">
            <CardContent className="pt-5 space-y-3">
              <Label className="font-bold text-base">ผู้ตรวจสอบ</Label>
              <div className="rounded-2xl bg-primary/10 p-4">
                <p className="font-semibold text-foreground">{profile?.full_name || "ผู้ใช้งาน"}</p>
                <p className="text-xs text-muted-foreground">กรอกอัตโนมัติจากบัญชีผู้ใช้</p>
              </div>
            </CardContent>
          </Card>

          {Object.entries(groups).map(([groupName, items]) => (
            <Card key={groupName} className="border border-border/50 shadow-elevated rounded-2xl">
              <CardHeader className="pb-2 pt-4 px-5">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">{groupIcons[groupName]}</span>
                  {groupName}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 px-5 pb-5">
                {items.map((item) => (
                  <div key={item.key} className={`flex items-center justify-between rounded-2xl p-4 transition-colors ${inspection[item.key] ? "bg-muted/50" : "bg-destructive/10 border border-destructive/30"}`}>
                    <div className="flex-1 mr-3">
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch checked={inspection[item.key]} onCheckedChange={() => toggleItem(item.key)} />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card className="border border-border/50 shadow-elevated rounded-2xl">
            <CardContent className="pt-5 space-y-3">
              <Label className="font-bold text-base">หมายเหตุ</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ข้อสังเกตเพิ่มเติม..." rows={2} className="rounded-2xl" />
            </CardContent>
          </Card>

          <Card className={`border shadow-elevated rounded-2xl border-2 ${allOkInspection(inspection) ? "border-primary/50" : "border-destructive/50"}`}>
            <CardContent className="pt-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-base font-bold">ผลตรวจรวม</span>
                <Badge variant={allOkInspection(inspection) ? "default" : "destructive"} className="rounded-xl">
                  {allOkInspection(inspection) ? "ปกติทุกรายการ" : `พบปัญหา ${Object.values(inspection).filter(v => !v).length} รายการ`}
                </Badge>
              </div>
              <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => createCheck.mutate()} disabled={createCheck.isPending || !locationId}>
                {createCheck.isPending ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border border-border/50 shadow-card rounded-2xl">
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select value={filterResult} onValueChange={setFilterResult}>
              <SelectTrigger className="h-10 text-sm w-28 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกผลตรวจ</SelectItem>
                <SelectItem value="ok">ปกติ</SelectItem>
                <SelectItem value="fail">พบปัญหา</SelectItem>
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
          </div>
          {filterPeriod === "custom" && (
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl", !customFrom && "text-slate-500")}>
                    {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-sm h-10 w-40 justify-start rounded-2xl", !customTo && "text-slate-500")}>
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

      {/* History */}
      <div className="space-y-3">
        {checks?.filter((c: any) => {
          const details: InspectionDetails | null = c.inspection_details;
          const allOk = details ? allOkInspection(details) : (c.pressure_ok && c.condition_ok);
          if (filterResult === "ok" && !allOk) return false;
          if (filterResult === "fail" && allOk) return false;
          const created = new Date(c.checked_at);
          const now = new Date();
          if (filterPeriod === "day" && created < startOfDay(now)) return false;
          if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
          if (filterPeriod === "month" && created < startOfMonth(now)) return false;
          if (filterPeriod === "custom" && customFrom && customTo) {
            if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
          }
          return true;
        }).map((c: any, idx: number) => {
          const details: InspectionDetails | null = c.inspection_details;
          const allOk = details ? allOkInspection(details) : (c.pressure_ok && c.condition_ok);
          const failCount = details ? Object.values(details).filter(v => !v).length : 0;
          const failItems = details ? inspectionItems.filter(item => !details[item.key]) : [];
          return (
            <Card key={c.id} className={`border border-slate-200 shadow-lg rounded-2xl animate-slide-up border-l-4 bg-white cursor-pointer hover:shadow-xl transition-all ${allOk ? "border-l-primary" : "border-l-destructive"}`} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => setSelectedCheck(c)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold leading-tight">{c.location_name || c.location}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {c.inspector_name && <p className="text-xs text-muted-foreground">ผู้ตรวจ: {c.inspector_name}</p>}
                  </div>
                  <Badge variant={allOk ? "default" : "destructive"} className="shrink-0 mt-0.5 rounded-xl">
                    {allOk ? "ปกติ" : `${failCount} รายการ`}
                  </Badge>
                </div>
                {!allOk && failItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {failItems.map((item) => (
                      <Badge key={item.key} variant="outline" className="text-[11px] border-destructive/40 text-destructive bg-destructive/5 rounded-xl">{item.label}</Badge>
                    ))}
                  </div>
                )}
                {c.notes && <p className="text-xs text-muted-foreground border-t pt-2">{c.notes}</p>}
              </CardContent>
            </Card>
          );
        })}
        {(!checks || checks.length === 0) && (
          <Card className="border border-slate-200 shadow-lg rounded-2xl bg-white">
            <CardContent className="flex flex-col items-center gap-2 py-10">
              <p className="text-sm text-muted-foreground">ยังไม่มีบันทึกการตรวจ</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedCheck} onOpenChange={() => setSelectedCheck(null)}>
        <DialogContent className="rounded-3xl max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">รายละเอียดการตรวจถังดับเพลิง</DialogTitle>
          </DialogHeader>
          {selectedCheck && (() => {
            const details: InspectionDetails | null = selectedCheck.inspection_details;
            const checkAllOk = details ? allOkInspection(details) : (selectedCheck.pressure_ok && selectedCheck.condition_ok);
            return (
              <div className="space-y-4">
                <div className="rounded-2xl bg-blue-50 p-4 space-y-1">
                  <p className="text-sm"><span className="font-semibold">ตำแหน่ง:</span> {selectedCheck.location_name || selectedCheck.location}</p>
                  <p className="text-sm"><span className="font-semibold">วันที่ตรวจ:</span> {new Date(selectedCheck.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                  <p className="text-sm"><span className="font-semibold">เวลา:</span> {new Date(selectedCheck.checked_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
                  <p className="text-sm"><span className="font-semibold">ผู้ตรวจ:</span> {selectedCheck.inspector_name || "-"}</p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-2xl border-2 border-dashed" style={{ borderColor: checkAllOk ? "#22c55e" : "#ef4444" }}>
                  <span className="font-bold">ผลตรวจรวม</span>
                  <Badge variant={checkAllOk ? "default" : "destructive"} className="rounded-xl text-sm">
                    {checkAllOk ? "✅ ปกติทุกรายการ" : `❌ พบปัญหา ${details ? Object.values(details).filter(v => !v).length : 0} รายการ`}
                  </Badge>
                </div>
                {details && (
                  <div className="space-y-2">
                    {inspectionItems.map((item) => (
                      <div key={item.key} className={`flex items-center justify-between rounded-xl p-3 ${details[item.key] ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                        <div>
                          <p className="text-sm font-semibold">{item.label}</p>
                          <p className="text-xs text-muted-foreground">{item.desc}</p>
                        </div>
                        <Badge variant={details[item.key] ? "default" : "destructive"} className="rounded-full text-xs">
                          {details[item.key] ? "ปกติ" : "ผิดปกติ"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
                {selectedCheck.notes && (
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-1">หมายเหตุ</p>
                    <p className="text-sm">{selectedCheck.notes}</p>
                  </div>
                )}
                <Button variant="outline" className="w-full rounded-2xl h-11 gap-1.5" onClick={() => {
                  const details: InspectionDetails | null = selectedCheck.inspection_details;
                  exportToExcel([{
                    "ตำแหน่ง": selectedCheck.location_name || selectedCheck.location,
                    "วันที่ตรวจ": new Date(selectedCheck.checked_at).toLocaleDateString("th-TH"),
                    "เวลา": new Date(selectedCheck.checked_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
                    "ผู้ตรวจ": selectedCheck.inspector_name || "-",
                    ...Object.fromEntries(inspectionItems.map(item => [item.label, details ? (details[item.key] ? "ปกติ" : "ผิดปกติ") : "-"])),
                    "หมายเหตุ": selectedCheck.notes || "-",
                  }], `fire-check-${new Date(selectedCheck.checked_at).toISOString().split("T")[0]}`, "ผลตรวจถังดับเพลิง");
                  toast.success("ส่งออก Excel สำเร็จ");
                }}>
                  <Download className="h-4 w-4" /> Export Excel
                </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
