import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, startOfDay } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Plus, Download, Pencil, CalendarIcon } from "lucide-react";
import ExcelJS from "exceljs";

const WATER_TYPES = [
  { value: "wastewater", label: "น้ำทิ้ง" },
  { value: "tap_water", label: "ประปา" },
  { value: "sludge", label: "กากตะกอน" },
];

const WASTEWATER_PARAMS = [
  { name: "ค่า pH", standard: "5-9", unit: "" },
  { name: "ปริมาณของแข็งละลายน้ำทั้งหมด", standard: "ไม่เกิน 500", unit: "mg./l." },
  { name: "ปริมาณของแข็งแขวนลอยทั้งหมด", standard: "ไม่เกิน 30", unit: "mg./l." },
  { name: "ปริมาณตะกอนหนัก", standard: "ไม่เกิน 0.5", unit: "mg./l." },
  { name: "ซัลไฟด์", standard: "ไม่เกิน 1", unit: "mg./l." },
  { name: "BOD", standard: "ไม่เกิน 20", unit: "mg./l." },
  { name: "COD", standard: "ไม่เกิน 120", unit: "mg./l." },
  { name: "ไขมันและน้ำมัน", standard: "ไม่เกิน 20", unit: "mg./l." },
  { name: "TKN", standard: "ไม่เกิน 35", unit: "mg./l." },
  { name: "Total Coliform Bacteria", standard: "ไม่เกิน 5,000", unit: "MPN/100ml." },
  { name: "Fecal Coliform Bacteria", standard: "ไม่เกิน 1,000", unit: "MPN/100ml." },
  { name: "Chlorine residual", standard: "ไม่เกิน 0.5", unit: "mg./l." },
];

const TAP_WATER_PARAMS = [
  { name: "ค่า pH", standard: "6.5 - 8.5", unit: "" },
  { name: "ปริมาณของแข็งละลายน้ำทั้งหมด", standard: "ไม่เกิน 1,000", unit: "mg./l." },
  { name: "สี", standard: "ไม่เกิน 15", unit: "แพลทินัม-โคบอลต์" },
  { name: "ความขุ่น", standard: "ไม่เกิน 5", unit: "เอ็นทียู" },
  { name: "ความกระด้าง", standard: "ไม่เกิน 500", unit: "mg./l." },
  { name: "คลอไรด์", standard: "ไม่เกิน 250", unit: "mg./l." },
  { name: "ฟลูออไรด์", standard: "ไม่เกิน 0.7", unit: "mg./l." },
  { name: "ซัลเฟต", standard: "ไม่เกิน 250", unit: "mg./l." },
  { name: "ไนเตรท", standard: "ไม่เกิน 50", unit: "mg./l." },
  { name: "สารหนู", standard: "ไม่เกิน 0.01", unit: "mg./l." },
  { name: "แคดเมียม", standard: "ไม่เกิน 0.003", unit: "mg./l." },
  { name: "โครเมียม", standard: "ไม่เกิน 0.05", unit: "mg./l." },
  { name: "ทองแดง", standard: "ไม่เกิน 1.0", unit: "mg./l." },
  { name: "เหล็ก", standard: "ไม่เกิน 0.5", unit: "mg./l." },
  { name: "ตะกั่ว", standard: "ไม่เกิน 0.01", unit: "mg./l." },
  { name: "แมงกานีส", standard: "ไม่เกิน 0.3", unit: "mg./l." },
  { name: "ปรอท", standard: "ไม่เกิน 0.001", unit: "mg./l." },
  { name: "สังกะสี", standard: "ไม่เกิน 3", unit: "mg./l." },
  { name: "แบคทีเรียชนิดโคลิฟอร์มทั้งหมดในน้ำ", standard: "ต้องตรวจไม่พบ", unit: "MPN/100ml." },
  { name: "เอสเชอริเชีย โคไล", standard: "ต้องตรวจไม่พบ", unit: "MPN/100ml." },
  { name: "Chlorine residual", standard: "ไม่เกิน 0.5", unit: "mg./l." },
  { name: "ไนไตรท์", standard: "ไม่เกิน 3", unit: "mg./l." },
];

const SLUDGE_PARAMS = [
  { name: "ไข่หนอนพยาธิ", standard: "<1 ฟอง/กรัม (น้ำหนักแห้ง)", unit: "" },
  { name: "E. coli", standard: "<1,000 MPN/กรัม (น้ำหนักแห้ง)", unit: "" },
];

function getParamsForType(waterType: string) {
  if (waterType === "wastewater") return WASTEWATER_PARAMS;
  if (waterType === "tap_water") return TAP_WATER_PARAMS;
  if (waterType === "sludge") return SLUDGE_PARAMS;
  return [];
}

function getSheetName(waterType: string) {
  if (waterType === "wastewater") return "น้ำทิ้ง";
  if (waterType === "tap_water") return "ประปา";
  if (waterType === "sludge") return "กากตะกอน";
  return waterType;
}

export default function WaterQualityBatchForm() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [waterType, setWaterType] = useState("wastewater");
  const [reportPeriod, setReportPeriod] = useState("");
  const [testDate, setTestDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState("all");
  const [editBatch, setEditBatch] = useState<any>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [batchItems, setBatchItems] = useState<any[]>([]);

  const { data: batches = [] } = useQuery({
    queryKey: ["water-quality-batches"],
    queryFn: async () => {
      const { data } = await supabase.from("water_quality_batches").select("*").order("created_at", { ascending: false }).limit(200);
      return data || [];
    },
  });

  const filteredBatches = useMemo(() => {
    if (filterType === "all") return batches;
    return batches.filter((b: any) => b.water_type === filterType);
  }, [batches, filterType]);

  const params = getParamsForType(waterType);

  const saveBatch = useMutation({
    mutationFn: async () => {
      if (!user || !reportPeriod) throw new Error("กรุณากรอกรอบการตรวจ");
      const { data: batch, error } = await supabase.from("water_quality_batches").insert({
        water_type: waterType, report_period: reportPeriod,
        test_date: testDate ? format(testDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
        recorded_by: user.id, recorder_name: profile?.full_name || "", notes: notes || null,
      }).select().single();
      if (error) throw error;
      const items = params.map((p, i) => ({
        batch_id: batch.id, parameter_name: p.name,
        test_result: paramValues[p.name] || null,
        standard_value: p.standard, unit: p.unit, sort_order: i,
      }));
      const { error: itemsError } = await supabase.from("water_quality_batch_items").insert(items);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("บันทึกผลตรวจสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-quality-batches"] });
      setShowForm(false);
      setParamValues({});
      setReportPeriod("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const viewBatchDetail = async (batch: any) => {
    setSelectedBatch(batch);
    const { data } = await supabase.from("water_quality_batch_items").select("*").eq("batch_id", batch.id).order("sort_order");
    setBatchItems(data || []);
  };

  const startEdit = async (batch: any) => {
    const { data } = await supabase.from("water_quality_batch_items").select("*").eq("batch_id", batch.id).order("sort_order");
    const vals: Record<string, string> = {};
    (data || []).forEach((item: any) => { vals[item.parameter_name] = item.test_result || ""; });
    setEditValues(vals);
    setEditBatch(batch);
  };

  const saveEdit = useMutation({
    mutationFn: async () => {
      if (!editBatch) return;
      for (const [paramName, value] of Object.entries(editValues)) {
        await supabase.from("water_quality_batch_items")
          .update({ test_result: value || null })
          .eq("batch_id", editBatch.id)
          .eq("parameter_name", paramName);
      }
    },
    onSuccess: () => {
      toast.success("แก้ไขข้อมูลสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["water-quality-batches"] });
      setEditBatch(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const exportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    for (const wt of ["wastewater", "tap_water", "sludge"] as const) {
      const sheetName = getSheetName(wt);
      const wtBatches = batches.filter((b: any) => b.water_type === wt).sort((a: any, b: any) => a.report_period.localeCompare(b.report_period));
      if (wtBatches.length === 0 && wt === "sludge") {
        const ws = workbook.addWorksheet(sheetName);
        ws.getCell("A1").value = `ผลการตรวจวิเคราะห์ - ${sheetName}`;
        ws.getCell("A2").value = "ยังไม่มีข้อมูล";
        continue;
      }
      const paramList = getParamsForType(wt);
      // Fetch all items for these batches
      const batchIds = wtBatches.map((b: any) => b.id);
      let allItems: any[] = [];
      if (batchIds.length > 0) {
        const { data } = await supabase.from("water_quality_batch_items").select("*").in("batch_id", batchIds).order("sort_order");
        allItems = data || [];
      }
      const ws = workbook.addWorksheet(sheetName);
      // Title row
      const titleText = wt === "wastewater" ? "ผลการตรวจวิเคราะห์คุณภาพน้ำทิ้ง" : wt === "tap_water" ? "ผลการตรวจวิเคราะห์คุณภาพน้ำประปา" : "ผลการตรวจวิเคราะห์กากตะกอน";
      ws.mergeCells(1, 1, 1, 3 + wtBatches.length + 2);
      const titleCell = ws.getCell("A1");
      titleCell.value = titleText;
      titleCell.font = { bold: true, size: 14 };
      titleCell.alignment = { horizontal: "center" };
      // Header row
      const headerRow = ws.getRow(2);
      headerRow.getCell(1).value = "ลำดับ";
      headerRow.getCell(2).value = "รายการตรวจ";
      wtBatches.forEach((b: any, i: number) => {
        headerRow.getCell(3 + i).value = b.report_period;
      });
      headerRow.getCell(3 + wtBatches.length).value = "ค่ามาตรฐาน";
      headerRow.getCell(4 + wtBatches.length).value = "หน่วย";
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
      });
      // Data rows
      paramList.forEach((param, pIdx) => {
        const row = ws.getRow(3 + pIdx);
        row.getCell(1).value = pIdx + 1;
        row.getCell(2).value = param.name;
        wtBatches.forEach((batch: any, bIdx: number) => {
          const item = allItems.find((it: any) => it.batch_id === batch.id && it.parameter_name === param.name);
          row.getCell(3 + bIdx).value = item?.test_result || "";
        });
        row.getCell(3 + wtBatches.length).value = param.standard;
        row.getCell(4 + wtBatches.length).value = param.unit;
        row.eachCell((cell) => {
          cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        });
        row.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
      });
      // Column widths
      ws.getColumn(1).width = 8;
      ws.getColumn(2).width = 35;
      for (let i = 0; i < wtBatches.length; i++) ws.getColumn(3 + i).width = 12;
      ws.getColumn(3 + wtBatches.length).width = 18;
      ws.getColumn(4 + wtBatches.length).width = 16;
    }
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "รวมผลตรวจวิเคราะห์คุณภาพน้ำ.xlsx";
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1 h-12 rounded-2xl text-base font-bold gap-2" onClick={() => setShowForm(true)}>
          <Plus className="h-5 w-5" /> บันทึกผลตรวจวิเคราะห์
        </Button>
        <Button variant="outline" className="h-12 rounded-2xl gap-1.5" onClick={exportExcel}>
          <Download className="h-4 w-4" /> Export Excel (3 Sheets)
        </Button>
      </div>

      <div className="flex gap-2">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-10 w-36 rounded-2xl text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทุกประเภท</SelectItem>
            {WATER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="h-10 px-4 flex items-center rounded-2xl">{filteredBatches.length} รายการ</Badge>
      </div>

      {/* History */}
      <div className="space-y-2">
        {filteredBatches.map((batch: any) => (
          <Card key={batch.id} className="rounded-2xl shadow-card border-0 cursor-pointer hover:shadow-elevated transition-all" onClick={() => viewBatchDetail(batch)}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{getSheetName(batch.water_type)} · รอบ {batch.report_period}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(batch.test_date), "d MMM yyyy", { locale: th })} · {batch.recorder_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full text-[10px]">{getSheetName(batch.water_type)}</Badge>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" onClick={(e) => { e.stopPropagation(); startEdit(batch); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {filteredBatches.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-card">
            <CardContent className="py-10 text-center text-muted-foreground text-sm">ยังไม่มีข้อมูล กดปุ่ม "บันทึกผลตรวจวิเคราะห์" เพื่อเริ่มต้น</CardContent>
          </Card>
        )}
      </div>

      {/* Add Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-lg">บันทึกผลตรวจวิเคราะห์คุณภาพน้ำ</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="font-semibold text-sm">ประเภทแหล่งน้ำ *</Label>
                <Select value={waterType} onValueChange={(v) => { setWaterType(v); setParamValues({}); }}>
                  <SelectTrigger className="h-11 rounded-2xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WATER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="font-semibold text-sm">รอบการตรวจ *</Label>
                <Input value={reportPeriod} onChange={(e) => setReportPeriod(e.target.value)} placeholder="เช่น 2/69" className="h-11 rounded-2xl" />
              </div>
            </div>
            <div>
              <Label className="font-semibold text-sm">วันที่ตรวจ</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full h-11 rounded-2xl justify-start text-left", !testDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {testDate ? format(testDate, "d MMMM yyyy", { locale: th }) : "เลือกวันที่"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={testDate} onSelect={setTestDate} disabled={(d) => d > new Date()} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="font-semibold text-sm">รายการตรวจ ({params.length} รายการ)</Label>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
                {params.map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                    <span className="text-xs font-medium w-6 text-center text-muted-foreground">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{p.name}</p>
                      <p className="text-[10px] text-muted-foreground">มาตรฐาน: {p.standard} {p.unit}</p>
                    </div>
                    <Input
                      value={paramValues[p.name] || ""}
                      onChange={(e) => setParamValues({ ...paramValues, [p.name]: e.target.value })}
                      placeholder="ผลตรวจ"
                      className="w-24 h-9 rounded-xl text-sm"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="font-semibold text-sm">หมายเหตุ</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="rounded-2xl" />
            </div>
            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => saveBatch.mutate()} disabled={saveBatch.isPending || !reportPeriod}>
              {saveBatch.isPending ? "กำลังบันทึก..." : "บันทึกผลตรวจ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!selectedBatch} onOpenChange={(o) => !o && setSelectedBatch(null)}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>รายละเอียดผลตรวจ</DialogTitle></DialogHeader>
          {selectedBatch && (
            <div className="space-y-3">
              <div className="rounded-2xl bg-blue-50 p-3 space-y-1 text-sm">
                <p><span className="font-semibold">ประเภท:</span> {getSheetName(selectedBatch.water_type)}</p>
                <p><span className="font-semibold">รอบ:</span> {selectedBatch.report_period}</p>
                <p><span className="font-semibold">วันที่:</span> {format(new Date(selectedBatch.test_date), "d MMMM yyyy", { locale: th })}</p>
                <p><span className="font-semibold">ผู้บันทึก:</span> {selectedBatch.recorder_name}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-blue-200 bg-blue-50/50">
                      <th className="text-left py-2 px-2 text-xs font-bold text-blue-700">#</th>
                      <th className="text-left py-2 px-2 text-xs font-bold text-blue-700">รายการ</th>
                      <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">ผลตรวจ</th>
                      <th className="text-center py-2 px-2 text-xs font-bold text-blue-700">มาตรฐาน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batchItems.map((item: any, i: number) => (
                      <tr key={item.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                        <td className="py-1.5 px-2 text-xs">{i + 1}</td>
                        <td className="py-1.5 px-2 text-xs font-medium">{item.parameter_name}</td>
                        <td className="py-1.5 px-2 text-center text-xs font-mono">{item.test_result || "-"}</td>
                        <td className="py-1.5 px-2 text-center text-xs text-muted-foreground">{item.standard_value} {item.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editBatch} onOpenChange={(o) => !o && setEditBatch(null)}>
        <DialogContent className="rounded-3xl max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>แก้ไขผลตรวจ - รอบ {editBatch?.report_period}</DialogTitle></DialogHeader>
          {editBatch && (
            <div className="space-y-3">
              <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                {getParamsForType(editBatch.water_type).map((p, i) => (
                  <div key={p.name} className="flex items-center gap-2 p-2 rounded-xl bg-slate-50">
                    <span className="text-xs font-medium w-6 text-center text-muted-foreground">{i + 1}</span>
                    <p className="flex-1 text-xs font-semibold truncate">{p.name}</p>
                    <Input
                      value={editValues[p.name] || ""}
                      onChange={(e) => setEditValues({ ...editValues, [p.name]: e.target.value })}
                      placeholder="ผลตรวจ"
                      className="w-24 h-9 rounded-xl text-sm"
                    />
                  </div>
                ))}
              </div>
              <Button className="w-full h-12 rounded-2xl font-bold" onClick={() => saveEdit.mutate()} disabled={saveEdit.isPending}>
                {saveEdit.isPending ? "กำลังบันทึก..." : "บันทึกการแก้ไข"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}