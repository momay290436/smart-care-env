import { useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfDay, parse } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportExcel";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, CalendarIcon, FileText, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import * as XLSX from "xlsx";

export default function WaterMeter() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [meterReading, setMeterReading] = useState("");
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  // Admin backdate fields
  const [customRecordDate, setCustomRecordDate] = useState<Date | undefined>();
  const [customTime, setCustomTime] = useState("");
  const [customShift, setCustomShift] = useState("");
  const [customRecorderName, setCustomRecorderName] = useState("");
  const [customRecorderId, setCustomRecorderId] = useState("");
  const [recorderSearch, setRecorderSearch] = useState("");

  const { data: allProfiles = [] } = useQuery({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("auth_id, full_name");
      return data || [];
    },
    enabled: isAdmin,
  });

  const filteredProfiles = useMemo(() => {
    if (!recorderSearch) return allProfiles;
    return allProfiles.filter((p: any) => p.full_name?.toLowerCase().includes(recorderSearch.toLowerCase()));
  }, [allProfiles, recorderSearch]);

  const { data: records = [] } = useQuery({
    queryKey: ["water-meter-records"],
    queryFn: async () => {
      const { data } = await supabase.from("water_meter_records").select("*").order("record_date", { ascending: false }).order("record_time", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return records.filter((r: any) => {
      if (startDate && new Date(r.record_date) < startOfDay(startDate)) return false;
      if (endDate && new Date(r.record_date) > new Date(startOfDay(endDate).getTime() + 86400000 - 1)) return false;
      return true;
    });
  }, [records, startDate, endDate]);

  // Group by date for display
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    filtered.forEach((r: any) => {
      if (!map[r.record_date]) map[r.record_date] = [];
      map[r.record_date].push(r);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const addRecord = useMutation({
    mutationFn: async () => {
      if (!user || !meterReading) throw new Error("กรุณากรอกเลขมิเตอร์");
      const reading = Number(meterReading);

      // Admin backdate support
      const isBackdate = isAdmin && customRecordDate;
      const recordDate = isBackdate ? format(customRecordDate!, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd");
      const timeStr = isBackdate && customTime ? customTime + ":00" : format(new Date(), "HH:mm:ss");
      const hour = isBackdate && customTime ? parseInt(customTime.split(":")[0]) : new Date().getHours();
      const shift = isBackdate && customShift ? customShift : (hour < 12 ? "morning" : "afternoon");
      const recorderName = isBackdate && customRecorderName ? customRecorderName : (profile?.full_name || "");
      const recordedBy = isBackdate && customRecorderId ? customRecorderId : user.id;

      // Get latest previous reading
      const { data: prev } = await supabase.from("water_meter_records")
        .select("meter_reading").order("record_date", { ascending: false }).order("record_time", { ascending: false }).limit(1);
      const prevReading = prev && prev.length > 0 ? Number(prev[0].meter_reading) : reading;
      const usageAmount = Math.max(0, reading - prevReading);

      // Check if there's a morning record today for daily total calc
      let dailyTotal: number | null = null;
      if (shift === "afternoon") {
        const { data: todayRecords } = await supabase.from("water_meter_records")
          .select("usage_amount").eq("record_date", recordDate).eq("shift", "morning");
        if (todayRecords && todayRecords.length > 0) {
          const morningUsage = Number(todayRecords[0].usage_amount);
          dailyTotal = morningUsage + usageAmount;
        }
      }

      const { error } = await supabase.from("water_meter_records").insert({
        record_date: recordDate,
        record_time: timeStr,
        shift,
        meter_reading: reading,
        usage_amount: usageAmount,
        daily_total: dailyTotal,
        recorded_by: recordedBy,
        recorder_name: recorderName,
        notes: notes || null,
      });
      if (error) throw error;

      // If afternoon, also update morning record's daily_total
      if (shift === "afternoon" && dailyTotal !== null) {
        await supabase.from("water_meter_records")
          .update({ daily_total: dailyTotal })
          .eq("record_date", recordDate).eq("shift", "morning");
      }
    },
    onSuccess: () => {
      toast.success("บันทึกมิเตอร์น้ำสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-meter-records"] });
      queryClient.invalidateQueries({ queryKey: ["water-meter-recent"] });
      setShowAddDialog(false);
      setMeterReading("");
      setNotes("");
      setCustomRecordDate(undefined);
      setCustomTime("");
      setCustomShift("");
      setCustomRecorderName("");
      setCustomRecorderId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = (exportType: "excel" | "pdf" = "excel") => {
    // Build data with merged cells
    const wb = XLSX.utils.book_new();
    const headers = ["วันที่", "เวลา", "มิเตอร์น้ำออก", "จำนวนน้ำที่ใช้ไป", "ผลรวม", "รายชื่อ", "หมายเหตุ"];
    const rows: any[][] = [headers];
    const merges: XLSX.Range[] = [];
    let rowIdx = 1;

    // Sort grouped by date ascending for export
    const sortedGrouped = [...grouped].sort((a, b) => a[0].localeCompare(b[0]));

    sortedGrouped.forEach(([date, dateRecords]) => {
      const sorted = [...dateRecords].sort((a: any, b: any) => a.record_time.localeCompare(b.record_time));
      const startRow = rowIdx;
      sorted.forEach((r: any) => {
        rows.push([
          format(new Date(date), "d/M/yyyy"),
          r.record_time?.substring(0, 5) || "-",
          Number(r.meter_reading),
          Number(r.usage_amount),
          r.daily_total != null ? Number(r.daily_total) : "",
          r.recorder_name || "-",
          r.notes || "-",
        ]);
        rowIdx++;
      });
      // Merge date column (col 0) for same-date rows
      if (sorted.length > 1) {
        merges.push({ s: { r: startRow, c: 0 }, e: { r: rowIdx - 1, c: 0 } });
      }
      // Merge daily_total column (col 4) for same-date rows
      if (sorted.length > 1) {
        merges.push({ s: { r: startRow, c: 4 }, e: { r: rowIdx - 1, c: 4 } });
      }
    });

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!merges"] = merges;
    // Set column widths
    ws["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 16 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "มิเตอร์น้ำ");

    if (exportType === "pdf") {
      // Generate printable HTML and open print dialog
      let html = `<html><head><meta charset="utf-8"><title>บันทึกมิเตอร์น้ำออก</title><style>
        body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #333;padding:6px 8px;text-align:center;font-size:12px}
        th{background:#1e40af;color:white}h2{text-align:center;margin-bottom:12px}
        .date-cell{font-weight:bold;background:#f0f4ff}
      </style></head><body><h2>บันทึกมิเตอร์น้ำออก</h2><table><thead><tr>`;
      headers.forEach(h => html += `<th>${h}</th>`);
      html += `</tr></thead><tbody>`;

      sortedGrouped.forEach(([date, dateRecords]) => {
        const sorted = [...dateRecords].sort((a: any, b: any) => a.record_time.localeCompare(b.record_time));
        sorted.forEach((r: any, i: number) => {
          html += `<tr>`;
          if (i === 0) html += `<td class="date-cell" rowspan="${sorted.length}">${format(new Date(date), "d/M/yyyy")}</td>`;
          html += `<td>${r.record_time?.substring(0, 5) || "-"}</td>`;
          html += `<td>${Number(r.meter_reading).toLocaleString()}</td>`;
          html += `<td>${Number(r.usage_amount).toLocaleString()}</td>`;
          if (i === 0) html += `<td class="date-cell" rowspan="${sorted.length}">${r.daily_total != null ? Number(r.daily_total).toLocaleString() : "-"}</td>`;
          html += `<td>${r.recorder_name || "-"}</td>`;
          html += `<td>${r.notes || "-"}</td>`;
          html += `</tr>`;
        });
      });

      html += `</tbody></table></body></html>`;
      const printWin = window.open("", "_blank");
      if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.onload = () => printWin.print();
      }
      return;
    }

    XLSX.writeFile(wb, "water-meter-records.xlsx");
    toast.success("ส่งออก Excel สำเร็จ");
  };

  const now = new Date();
  const currentShift = now.getHours() < 12 ? "รอบเช้า (ก่อน 12:00)" : "รอบบ่าย (หลัง 12:00)";

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="บันทึกมิเตอร์น้ำออก" subtitle="Water Meter Records">
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1.5 bg-white/20 border-white/30 text-white hover:bg-white/30" onClick={() => handleExport("excel")}>
          <Download className="h-3.5 w-3.5" /> Excel
        </Button>
        <Button size="sm" variant="outline" className="rounded-2xl text-xs h-9 gap-1.5 bg-white/20 border-white/30 text-white hover:bg-white/30" onClick={() => handleExport("pdf")}>
          <FileText className="h-3.5 w-3.5" /> PDF
        </Button>
      </PageHeader>

      {/* Add Button */}
      <Button className="w-full h-14 rounded-2xl text-base font-bold gap-2 shadow-elevated" onClick={() => setShowAddDialog(true)}>
        <Plus className="h-5 w-5" /> เพิ่มข้อมูลมิเตอร์
      </Button>

      {/* Date Filter */}
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">กรองวันที่:</span>
            {[
              { val: startDate, set: setStartDate, placeholder: "วันเริ่มต้น" },
              { val: endDate, set: setEndDate, placeholder: "วันสิ้นสุด" },
            ].map((cfg, i) => (
              <Popover key={i}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-sm h-9 w-36 justify-start rounded-2xl", !cfg.val && "text-slate-400")}>
                    {cfg.val ? format(cfg.val, "d MMM yy", { locale: th }) : cfg.placeholder}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={cfg.val} onSelect={cfg.set} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            ))}
            {(startDate || endDate) && (
              <Button variant="ghost" size="sm" className="text-xs rounded-2xl" onClick={() => { setStartDate(undefined); setEndDate(undefined); }}>ล้าง</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card className="bg-white rounded-2xl shadow-elevated border-0">
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-blue-200 bg-blue-50/50">
                  <th className="text-left py-3 px-2 text-xs font-bold text-blue-700">วันที่</th>
                  <th className="text-center py-3 px-2 text-xs font-bold text-blue-700">เวลา</th>
                  <th className="text-right py-3 px-2 text-xs font-bold text-blue-700">มิเตอร์น้ำออก</th>
                  <th className="text-right py-3 px-2 text-xs font-bold text-blue-700">จำนวนน้ำที่ใช้ไป</th>
                  <th className="text-right py-3 px-2 text-xs font-bold text-blue-700">ผลรวม</th>
                  <th className="text-center py-3 px-2 text-xs font-bold text-blue-700">รายชื่อ</th>
                  <th className="text-left py-3 px-2 text-xs font-bold text-blue-700">หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(([date, dateRecords]) => (
                  dateRecords.sort((a: any, b: any) => a.record_time.localeCompare(b.record_time)).map((r: any, i: number) => (
                    <tr key={r.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                      {i === 0 ? (
                        <td className="py-2.5 px-2 text-xs font-semibold border-r border-slate-100" rowSpan={dateRecords.length}>
                          {format(new Date(date), "d/M/yy")}
                        </td>
                      ) : null}
                      <td className="py-2.5 px-2 text-center text-xs">{r.record_time?.substring(0, 5)}</td>
                      <td className="py-2.5 px-2 text-right text-xs font-mono font-semibold">{Number(r.meter_reading).toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-right text-xs font-mono">{Number(r.usage_amount).toLocaleString()}</td>
                      <td className="py-2.5 px-2 text-right text-xs font-mono font-bold text-blue-600">{r.daily_total != null ? Number(r.daily_total).toLocaleString() : "-"}</td>
                      <td className="py-2.5 px-2 text-center text-xs">{r.recorder_name || "-"}</td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">{r.notes || "-"}</td>
                    </tr>
                  ))
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog} modal={true}>
        <DialogContent className="rounded-3xl max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">บันทึกมิเตอร์น้ำออก</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isAdmin ? (
              <div className="space-y-3">
                <div>
                  <Label className="font-semibold text-sm">วันที่บันทึก</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start text-left", !customRecordDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {customRecordDate ? format(customRecordDate, "d MMMM yyyy", { locale: th }) : "เลือกวันที่ (ว่าง = วันนี้)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={customRecordDate} onSelect={setCustomRecordDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="font-semibold text-sm">เวลา</Label>
                    <Input type="time" value={customTime} onChange={(e) => setCustomTime(e.target.value)} placeholder="HH:mm" className="h-12 rounded-2xl" />
                  </div>
                  <div>
                    <Label className="font-semibold text-sm">รอบ</Label>
                    <Select value={customShift} onValueChange={setCustomShift}>
                      <SelectTrigger className="h-12 rounded-2xl"><SelectValue placeholder="อัตโนมัติ" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="morning">รอบเช้า</SelectItem>
                        <SelectItem value="afternoon">รอบบ่าย</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="font-semibold text-sm">ผู้บันทึก</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start text-left", !customRecorderName && "text-muted-foreground")}>
                        <Search className="mr-2 h-4 w-4" />
                        {customRecorderName || "เลือกผู้บันทึก (ว่าง = ตัวเอง)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="ค้นหาชื่อ..." value={recorderSearch} onValueChange={setRecorderSearch} />
                        <CommandList>
                          <CommandEmpty>ไม่พบผู้ใช้</CommandEmpty>
                          <CommandGroup>
                            {filteredProfiles.map((p: any) => (
                              <CommandItem key={p.auth_id} onSelect={() => { setCustomRecorderName(p.full_name); setCustomRecorderId(p.auth_id); }}>
                                {p.full_name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                {!customRecordDate && (
                  <div className="rounded-2xl bg-blue-50 p-3 space-y-1 text-xs text-muted-foreground">
                    💡 ไม่เลือกวันที่/เวลา = บันทึกปัจจุบัน, ไม่เลือกผู้บันทึก = ตัวเอง
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl bg-blue-50 p-3 space-y-1 text-sm">
                <p><span className="font-semibold">วันที่:</span> {now.toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}</p>
                <p><span className="font-semibold">เวลา:</span> {now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.</p>
                <p><span className="font-semibold">รอบ:</span> {currentShift}</p>
                <p><span className="font-semibold">ผู้บันทึก:</span> {profile?.full_name || "ผู้ใช้งาน"}</p>
              </div>
            )}
            <div>
              <Label className="font-semibold">เลขมิเตอร์น้ำออก *</Label>
              <Input type="number" value={meterReading} onChange={(e) => setMeterReading(e.target.value)} placeholder="เช่น 167463" className="h-12 rounded-2xl text-lg font-mono" />
            </div>
            <div>
              <Label className="font-semibold">หมายเหตุ</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ข้อสังเกตเพิ่มเติม (ถ้ามี)..." rows={2} className="rounded-2xl" />
            </div>
            <p className="text-xs text-muted-foreground">💡 ระบบจะคำนวณ "จำนวนน้ำที่ใช้ไป" อัตโนมัติจากเลขมิเตอร์ครั้งก่อนหน้า และรวมผลรวมวันเมื่อบันทึกรอบบ่ายเสร็จ</p>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => addRecord.mutate()} disabled={addRecord.isPending || !meterReading}>
              {addRecord.isPending ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
