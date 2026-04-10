import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";
import PageHeader from "@/components/PageHeader";

const categories = [
  { key: "seiri", label: "สะสาง (Seiri)", desc: "แยกสิ่งจำเป็นออกจากสิ่งไม่จำเป็น" },
  { key: "seiton", label: "สะดวก (Seiton)", desc: "จัดวางของให้เป็นระเบียบ" },
  { key: "seiso", label: "สะอาด (Seiso)", desc: "ทำความสะอาดสถานที่" },
  { key: "seiketsu", label: "สุขลักษณะ (Seiketsu)", desc: "รักษามาตรฐานความสะอาด" },
  { key: "shitsuke", label: "สร้างนิสัย (Shitsuke)", desc: "ปฏิบัติจนเป็นนิสัย" },
];

function getGrade(score: number) {
  if (score >= 80) return { label: "ดีมาก", color: "bg-success text-success-foreground" };
  if (score >= 50) return { label: "พอใช้", color: "bg-warning text-warning-foreground" };
  return { label: "ต้องปรับปรุง", color: "bg-destructive text-destructive-foreground" };
}

export default function Audit5S() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deptId, setDeptId] = useState(profile?.department_id || "");
  const [scores, setScores] = useState<Record<string, number>>({
    seiri: 50, seiton: 50, seiso: 50, seiketsu: 50, shitsuke: 50,
  });
  const [notes, setNotes] = useState("");
  const [auditorName, setAuditorName] = useState(profile?.full_name || "");
  const [photoBefore, setPhotoBefore] = useState<File | null>(null);
  const [photoDuring, setPhotoDuring] = useState<File | null>(null);
  const [photoAfter, setPhotoAfter] = useState<File | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const { data: audits } = useQuery({
    queryKey: ["audits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_5s")
        .select("*, departments(name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const uploadPhoto = async (file: File, prefix: string) => {
    const ext = file.name.split(".").pop();
    const path = `${prefix}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("photos").upload(path, file);
    if (error) throw error;
    const { data } = supabase.storage.from("photos").getPublicUrl(path);
    return data.publicUrl;
  };

  const createAudit = useMutation({
    mutationFn: async () => {
      if (!user || !deptId) throw new Error("ข้อมูลไม่ครบ");
      const totalScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);
      let photoBeforeUrl = null;
      let photoAfterUrl = null;
      if (photoBefore) photoBeforeUrl = await uploadPhoto(photoBefore, "5s-before");
      if (photoAfter) photoAfterUrl = await uploadPhoto(photoAfter, "5s-after");
      const { error } = await supabase.from("audit_5s").insert({
        department_id: deptId, auditor_id: user.id,
        score_json: { ...scores, auditor_name: auditorName || profile?.full_name || "" },
        total_score: totalScore, notes,
        photo_before: photoBeforeUrl, photo_after: photoAfterUrl,
      });
      if (error) throw error;
      const dept = departments?.find((d) => d.id === deptId);
      // Sync to Google Sheets & Drive
      try {
        await supabase.functions.invoke("sync-google-sheets", {
          body: {
            type: "5s",
            data: {
              department: dept?.name || "", auditor: auditorName || profile?.full_name || "",
              scores, totalScore, grade: getGrade(totalScore).label,
              notes, date: new Date().toLocaleDateString("th-TH"),
              photoBeforeUrl, photoAfterUrl,
            },
          },
        });
      } catch {}
      // Upload photos to Google Drive
      try {
        if (photoBeforeUrl) await supabase.functions.invoke("upload-google-drive", { body: { imageUrl: photoBeforeUrl, fileName: `5S_before_${dept?.name}_${Date.now()}.jpg`, subFolder: "5S Audit Photos" } });
        if (photoAfterUrl) await supabase.functions.invoke("upload-google-drive", { body: { imageUrl: photoAfterUrl, fileName: `5S_after_${dept?.name}_${Date.now()}.jpg`, subFolder: "5S Audit Photos" } });
      } catch {}
      try {
        await supabase.functions.invoke("line-notify", {
          body: { message: `📋 ผลตรวจ 5ส\nผู้ตรวจ: ${profile?.full_name}\nแผนก: ${dept?.name}\nคะแนนรวม: ${totalScore}%\nเกรด: ${getGrade(totalScore).label}` },
        });
      } catch {}
    },
    onSuccess: () => {
      toast.success("บันทึกผลการตรวจ 5ส สำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["audits"] });
      queryClient.invalidateQueries({ queryKey: ["avg-5s-score"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setScores({ seiri: 50, seiton: 50, seiso: 50, seiketsu: 50, shitsuke: 50 });
    setNotes(""); setAuditorName(profile?.full_name || "");
    setPhotoBefore(null); setPhotoDuring(null); setPhotoAfter(null);
    setPhotoBefore(null); setPhotoAfter(null);
  };

  const totalScore = Math.round(Object.values(scores).reduce((a, b) => a + b, 0) / 5);

  const handleDownloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch { toast.error("ไม่สามารถดาวน์โหลดรูปภาพได้"); }
  };

  const handleDownloadData = (audit: any) => {
    const scoreJson = audit.score_json as Record<string, number>;
    const lines = [
      `ผลการตรวจ 5ส`, `แผนก: ${audit.departments?.name || "-"}`,
      `วันที่: ${new Date(audit.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}`,
      `คะแนนรวม: ${audit.total_score}%`, `เกรด: ${getGrade(Number(audit.total_score)).label}`,
      ``, `--- คะแนนรายหมวด ---`,
      ...categories.map((c) => `${c.label}: ${scoreJson?.[c.key] ?? "-"}%`),
      ``, `หมายเหตุ: ${audit.notes || "-"}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `5s-audit-${new Date(audit.created_at).toISOString().split("T")[0]}.txt`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4 pb-6">
      <PageHeader title="การตรวจ 5ส" subtitle="ประเมินและบันทึกผลการตรวจ 5ส" gradient="from-primary/10 to-accent/40">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 border-primary/30 text-primary" onClick={() => {
          const filtered = audits?.filter((audit: any) => {
            if (filterDept !== "all" && audit.department_id !== filterDept) return false;
            if (filterGrade !== "all") {
              const s = Number(audit.total_score);
              if (filterGrade === "good" && s < 80) return false;
              if (filterGrade === "fair" && (s < 50 || s >= 80)) return false;
              if (filterGrade === "poor" && s >= 50) return false;
            }
            return true;
          }) || [];
          exportToExcel(filtered.map((a: any) => ({
            "วันที่": new Date(a.created_at).toLocaleDateString("th-TH"),
            "แผนก": a.departments?.name || "-",
            "คะแนนรวม": a.total_score, "เกรด": getGrade(Number(a.total_score)).label,
            "หมายเหตุ": a.notes || "-",
          })), "audit-5s", "ผลตรวจ5ส");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>Excel</Button>
        <Button size="sm" className="rounded-2xl h-9" onClick={() => setShowForm(!showForm)}>
          {showForm ? "ซ่อน" : "+ บันทึกใหม่"}
        </Button>
      </PageHeader>

      {showForm && (
        <Card className="border border-border/50 shadow-elevated animate-slide-up bg-card rounded-2xl">
          <CardContent className="space-y-4 pt-5">
            <div className="rounded-2xl card-ocean p-4 space-y-1">
              <p className="text-base"><span className="font-semibold">วันที่ตรวจ:</span> {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
              <p className="text-base"><span className="font-semibold">เวลาที่ตรวจ:</span> {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">ชื่อผู้ตรวจ</Label>
              <Input value={auditorName} onChange={(e) => setAuditorName(e.target.value)} placeholder="ระบุชื่อผู้ตรวจ" className="h-12 rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">แผนก</Label>
              <Select value={deptId} onValueChange={setDeptId}>
                <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="เลือกแผนก" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {categories.map((cat) => {
              const val = scores[cat.key];
              const scoreColor = val <= 30 ? "text-red-500" : val <= 50 ? "text-orange-500" : val <= 70 ? "text-yellow-600" : "text-green-600";
              return (
                <div key={cat.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">{cat.label}</Label>
                    <span className={`text-base font-bold ${scoreColor}`}>{val}%</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{cat.desc}</p>
                  <Slider gradient value={[val]} onValueChange={([v]) => setScores({ ...scores, [cat.key]: v })} max={100} step={5} className="py-1" />
                </div>
              );
            })}
            <div className="flex items-center justify-between rounded-2xl card-ocean p-4">
              <span className="text-base font-semibold">คะแนนรวม</span>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">{totalScore}%</span>
                <Badge className={getGrade(totalScore).color + " rounded-xl"}>{getGrade(totalScore).label}</Badge>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">ภาพก่อน (Before)</Label>
                <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-border p-4 transition-colors hover:border-primary">
                  <span className="text-xs text-muted-foreground text-center">{photoBefore ? photoBefore.name.slice(0, 12) : "เลือกรูป"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoBefore(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">ขณะทำ (During)</Label>
                <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/50 p-4 transition-colors hover:border-amber-500">
                  <span className="text-xs text-muted-foreground text-center">{photoDuring ? photoDuring.name.slice(0, 12) : "เลือกรูป"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoDuring(e.target.files?.[0] || null)} />
                </label>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">ภาพหลัง (After)</Label>
                <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed border-border p-4 transition-colors hover:border-primary">
                  <span className="text-xs text-muted-foreground text-center">{photoAfter ? photoAfter.name.slice(0, 12) : "เลือกรูป"}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setPhotoAfter(e.target.files?.[0] || null)} />
                </label>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-semibold">หมายเหตุ</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="บันทึกเพิ่มเติม..." rows={2} className="rounded-2xl" />
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => createAudit.mutate()} disabled={createAudit.isPending}>
              {createAudit.isPending ? "กำลังบันทึก..." : "บันทึกผลการตรวจ"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="border border-slate-200 shadow-lg rounded-2xl bg-white">
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="h-10 text-sm w-32 rounded-2xl"><SelectValue placeholder="แผนก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแผนก</SelectItem>
                {departments?.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterGrade} onValueChange={setFilterGrade}>
              <SelectTrigger className="h-10 text-sm w-28 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกเกรด</SelectItem>
                <SelectItem value="good">ดีมาก (≥80)</SelectItem>
                <SelectItem value="fair">พอใช้ (50-79)</SelectItem>
                <SelectItem value="poor">ต้องปรับปรุง (&lt;50)</SelectItem>
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
        {audits?.filter((audit: any) => {
          if (filterDept !== "all" && audit.department_id !== filterDept) return false;
          if (filterGrade !== "all") {
            const s = Number(audit.total_score);
            if (filterGrade === "good" && s < 80) return false;
            if (filterGrade === "fair" && (s < 50 || s >= 80)) return false;
            if (filterGrade === "poor" && s >= 50) return false;
          }
          if (filterPeriod !== "all" && filterPeriod !== "custom") {
            const now = new Date();
            const created = new Date(audit.created_at);
            if (filterPeriod === "day" && created < startOfDay(now)) return false;
            if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
            if (filterPeriod === "month" && created < startOfMonth(now)) return false;
          }
          if (filterPeriod === "custom" && customFrom && customTo) {
            const created = new Date(audit.created_at);
            if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
          }
          return true;
        }).map((audit: any, idx: number) => {
          const grade = getGrade(Number(audit.total_score));
          return (
            <Card key={audit.id} className="border border-slate-200 shadow-lg rounded-2xl animate-slide-up cursor-pointer transition-all hover:shadow-2xl active:scale-[0.98] bg-white" style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => setSelectedAudit(audit)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{audit.departments?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(audit.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                      {" "}
                      {new Date(audit.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                    </p>
                    {(audit.score_json as any)?.auditor_name && (
                      <p className="text-xs text-muted-foreground">ผู้ตรวจ: {(audit.score_json as any).auditor_name}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-primary">{audit.total_score}%</span>
                    <Badge className={grade.color + " rounded-xl"}>{grade.label}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedAudit} onOpenChange={(open) => !open && setSelectedAudit(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>รายละเอียดการตรวจ 5ส</DialogTitle></DialogHeader>
          {selectedAudit && (
            <div className="space-y-4">
              <div className="rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 p-3 space-y-1">
                <p className="text-base"><span className="font-medium">แผนก:</span> {selectedAudit.departments?.name}</p>
                <p className="text-base"><span className="font-medium">วันที่:</span> {new Date(selectedAudit.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                <p className="text-base"><span className="font-medium">เวลา:</span> {new Date(selectedAudit.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
                {(selectedAudit.score_json as any)?.auditor_name && (
                  <p className="text-base"><span className="font-medium">ผู้ตรวจ:</span> {(selectedAudit.score_json as any).auditor_name}</p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-base font-medium">คะแนนรวม:</span>
                  <span className="text-lg font-bold text-primary">{selectedAudit.total_score}%</span>
                  <Badge className={getGrade(Number(selectedAudit.total_score)).color}>
                    {getGrade(Number(selectedAudit.total_score)).label}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-base font-semibold">คะแนนรายหมวด</p>
                {categories.map((cat) => {
                  const scoreJson = selectedAudit.score_json as Record<string, number>;
                  const val = scoreJson?.[cat.key] ?? 0;
                  return (
                    <div key={cat.key} className="flex items-center justify-between text-base">
                      <span>{cat.label}</span>
                      <span className="font-semibold text-primary">{val}%</span>
                    </div>
                  );
                })}
              </div>
              {selectedAudit.notes && (
                <div>
                  <p className="text-base font-semibold mb-1">หมายเหตุ</p>
                  <p className="text-base text-muted-foreground">{selectedAudit.notes}</p>
                </div>
              )}
              {(selectedAudit.photo_before || selectedAudit.photo_after) && (
                <div className="space-y-2">
                  <p className="text-base font-semibold">รูปภาพ</p>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedAudit.photo_before && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Before</p>
                        <img src={selectedAudit.photo_before} alt="Before" className="rounded-xl object-cover w-full h-32" />
                        <Button size="sm" variant="outline" className="w-full text-xs rounded-xl" onClick={() => handleDownloadImage(selectedAudit.photo_before, "5s-before.jpg")}>ดาวน์โหลด</Button>
                      </div>
                    )}
                    {selectedAudit.photo_after && (
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">After</p>
                        <img src={selectedAudit.photo_after} alt="After" className="rounded-xl object-cover w-full h-32" />
                        <Button size="sm" variant="outline" className="w-full text-xs rounded-xl" onClick={() => handleDownloadImage(selectedAudit.photo_after, "5s-after.jpg")}>ดาวน์โหลด</Button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <Button variant="outline" className="w-full rounded-xl" onClick={() => handleDownloadData(selectedAudit)}>ดาวน์โหลดข้อมูลผลตรวจ (.txt)</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
