import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Plus, Trash2, CalendarIcon, Download, Pencil } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import * as XLSX from "xlsx";

const HEALTH_CENTERS = [
  "รพ.สต.โป่งปูเฟือง", "รพ.สต.โป่งกลางน้ำ", "รพ.สต.ทุ่งพร้าว", "รพ.สต.ห้วยไคร้",
  "รพ.สต.วาวี", "รพ.สต.บ้านดอยช้าง", "รพ.สต.แม่สรวย", "โรงพยาบาลแม่สรวย", "รพ.สต.เจดีย์หลวง",
  "รพ.สต.ศรีถ้อย", "รพ.สต.ห้วยน้ำขุ่น", "รพ.สต.ท่าก๊อ", "รพ.สต.ป่าแดด",
];

interface WasteRow {
  health_center_name: string;
  sharp_waste_kg: string;
  non_sharp_waste_kg: string;
  delivered_by: string;
}

export default function InfectiousWasteTab() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [collectionDate, setCollectionDate] = useState<Date | undefined>(new Date());
  const [transferDate, setTransferDate] = useState<Date | undefined>();
  const [rows, setRows] = useState<WasteRow[]>([{ health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "" }]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editItem, setEditItem] = useState<any>(null);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), "yyyy-MM"));

  const { data: records = [] } = useQuery({
    queryKey: ["infectious-waste"],
    queryFn: async () => {
      const { data } = await supabase.from("infectious_waste_records").select("*").order("created_at", { ascending: false }).limit(500);
      return data || [];
    },
  });

  const filteredRecords = useMemo(() => {
    return records.filter((r: any) => {
      const dateToCheck = r.collection_date || r.transfer_date || r.created_at;
      if (!dateToCheck) return true;
      return dateToCheck.startsWith(filterMonth);
    });
  }, [records, filterMonth]);

  const addRow = () => setRows([...rows, { health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "" }]);
  const removeRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof WasteRow, value: string) => {
    const updated = [...rows];
    updated[i] = { ...updated[i], [field]: value };
    setRows(updated);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user || !collectionDate) throw new Error("กรุณาเลือกวันที่");
      const validRows = rows.filter(r => r.health_center_name);
      if (validRows.length === 0) throw new Error("กรุณากรอกข้อมูลอย่างน้อย 1 รายการ");
      const inserts = validRows.map(r => ({
        collection_date: format(collectionDate, "yyyy-MM-dd"),
        transfer_date: transferDate ? format(transferDate, "yyyy-MM-dd") : null,
        health_center_name: r.health_center_name,
        sharp_waste_kg: parseFloat(r.sharp_waste_kg) || 0,
        non_sharp_waste_kg: parseFloat(r.non_sharp_waste_kg) || 0,
        delivered_by: r.delivered_by || null,
        recorded_by: user.id,
      }));
      const { error } = await supabase.from("infectious_waste_records").insert(inserts);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกข้อมูลขยะติดเชื้อสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["infectious-waste"] });
      setShowForm(false);
      setRows([{ health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "" }]);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("infectious_waste_records").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("ลบสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["infectious-waste"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase.from("infectious_waste_records").update({
        health_center_name: item.health_center_name,
        sharp_waste_kg: item.sharp_waste_kg,
        non_sharp_waste_kg: item.non_sharp_waste_kg,
        delivered_by: item.delivered_by,
        collection_date: item.collection_date,
        transfer_date: item.transfer_date,
      }).eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("แก้ไขสำเร็จ"); queryClient.invalidateQueries({ queryKey: ["infectious-waste"] }); setEditItem(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleExport = () => {
    const [year, month] = filterMonth.split("-");
    const monthNames = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
    const title = `บันทึกการจัดเก็บขยะติดเชื้อ รพ.สต.อำเภอแม่สรวย ประจำเดือน${monthNames[parseInt(month)-1]} พ.ศ.${parseInt(year)+543}`;
    const headers = ["วัน/เดือน/ปี", "ชื่อหน่วยงานที่นำขยะมาส่งมอบ", "จำนวน มีคม (กก.)", "จำนวน ไม่มีคม (กก.)", "ชื่อผู้นำส่ง", "วันที่ส่งขยะให้กับ ม.แม่ฟ้าหลวง"];
    const sorted = [...filteredRecords].sort((a: any, b: any) => a.collection_date.localeCompare(b.collection_date));
    const dataRows = sorted.map((r: any) => [
      r.collection_date ? new Date(r.collection_date).toLocaleDateString("th-TH") : "-",
      r.health_center_name,
      r.sharp_waste_kg || 0,
      r.non_sharp_waste_kg || 0,
      r.delivered_by || "-",
      r.transfer_date ? new Date(r.transfer_date).toLocaleDateString("th-TH") : "-",
    ]);
    const ws = XLSX.utils.aoa_to_sheet([[title], [], headers, ...dataRows]);
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
    ws["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ขยะติดเชื้อ");
    XLSX.writeFile(wb, `infectious-waste-${filterMonth}.xlsx`);
    toast.success("ส่งออก Excel สำเร็จ");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="w-40 h-10 rounded-2xl" />
          <Button size="sm" variant="outline" className="rounded-2xl h-10 gap-1" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
        <Button className="rounded-2xl h-10 gap-1" onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4" /> บันทึกใหม่
        </Button>
      </div>

      {/* Records list */}
      <div className="space-y-2">
        {filteredRecords.map((r: any) => (
          <Card key={r.id} className="rounded-2xl border-0 shadow-card bg-white/90 backdrop-blur-sm">
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{r.health_center_name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  รับ: {r.collection_date ? new Date(r.collection_date).toLocaleDateString("th-TH") : "-"}
                  {r.transfer_date && ` · ส่ง: ${new Date(r.transfer_date).toLocaleDateString("th-TH")}`}
                </p>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-red-600 font-semibold">มีคม: {r.sharp_waste_kg} กก.</span>
                  <span className="text-amber-600 font-semibold">ไม่มีคม: {r.non_sharp_waste_kg} กก.</span>
                </div>
                {r.delivered_by && <p className="text-xs text-muted-foreground mt-0.5">ผู้นำส่ง: {r.delivered_by}</p>}
              </div>
              {isAdmin && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={() => setEditItem({...r})}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl text-destructive" onClick={() => setDeleteId(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {filteredRecords.length === 0 && (
          <Card className="rounded-2xl border-0 shadow-card"><CardContent className="py-10 text-center text-muted-foreground text-sm">ไม่มีข้อมูลในเดือนที่เลือก</CardContent></Card>
        )}
      </div>

      {/* Add form dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-3xl rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>บันทึกการจัดเก็บขยะติดเชื้อ</DialogTitle></DialogHeader>
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <Label className="text-sm font-semibold">วันที่รับขยะ *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start", !collectionDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {collectionDate ? format(collectionDate, "d MMM yy", { locale: th }) : "เลือก"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]"><Calendar mode="single" selected={collectionDate} onSelect={setCollectionDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
              <div>
                <Label className="text-sm font-semibold">วันที่ส่งต่อ ม.แม่ฟ้าหลวง</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full h-12 rounded-2xl justify-start", !transferDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {transferDate ? format(transferDate, "d MMM yy", { locale: th }) : "เลือก"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-[9999]"><Calendar mode="single" selected={transferDate} onSelect={setTransferDate} initialFocus className="p-3 pointer-events-auto" /></PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-3">
              {rows.map((row, i) => (
                <Card key={i} className="rounded-2xl border bg-slate-50/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-muted-foreground">รายการ #{i+1}</span>
                      {rows.length > 1 && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(i)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                    <Select value={row.health_center_name} onValueChange={(v) => updateRow(i, "health_center_name", v)}>
                      <SelectTrigger className="h-12 rounded-xl text-sm"><SelectValue placeholder="เลือก รพ.สต. / โรงพยาบาล" /></SelectTrigger>
                      <SelectContent>{HEALTH_CENTERS.map(hc => <SelectItem key={hc} value={hc}>{hc}</SelectItem>)}</SelectContent>
                    </Select>
                    <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                      <div>
                        <Label className="text-xs font-semibold">มีคม (กก.)</Label>
                        <Input type="number" step="0.1" min="0" value={row.sharp_waste_kg} onChange={e => updateRow(i, "sharp_waste_kg", e.target.value)} className="h-12 rounded-xl text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">ไม่มีคม (กก.)</Label>
                        <Input type="number" step="0.1" min="0" value={row.non_sharp_waste_kg} onChange={e => updateRow(i, "non_sharp_waste_kg", e.target.value)} className="h-12 rounded-xl text-sm" />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold">ผู้นำส่ง</Label>
                        <Input value={row.delivered_by} onChange={e => updateRow(i, "delivered_by", e.target.value)} className="h-12 rounded-xl text-sm" placeholder="ชื่อ" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" className="w-full rounded-2xl h-12 text-sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> เพิ่มรายการ</Button>
            </div>

            <Button className="w-full h-12 rounded-2xl text-base font-bold" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "กำลังบันทึก..." : "บันทึกทั้งหมด"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader><DialogTitle>แก้ไขข้อมูล</DialogTitle></DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <Select value={editItem.health_center_name} onValueChange={v => setEditItem({...editItem, health_center_name: v})}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{HEALTH_CENTERS.map(hc => <SelectItem key={hc} value={hc}>{hc}</SelectItem>)}</SelectContent>
              </Select>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">มีคม (กก.)</Label><Input type="number" value={editItem.sharp_waste_kg} onChange={e => setEditItem({...editItem, sharp_waste_kg: e.target.value})} className="h-10 rounded-xl" /></div>
                <div><Label className="text-xs">ไม่มีคม (กก.)</Label><Input type="number" value={editItem.non_sharp_waste_kg} onChange={e => setEditItem({...editItem, non_sharp_waste_kg: e.target.value})} className="h-10 rounded-xl" /></div>
              </div>
              <div><Label className="text-xs">ผู้นำส่ง</Label><Input value={editItem.delivered_by || ""} onChange={e => setEditItem({...editItem, delivered_by: e.target.value})} className="h-10 rounded-xl" /></div>
              <Button className="w-full h-11 rounded-2xl font-bold" onClick={() => updateMutation.mutate(editItem)} disabled={updateMutation.isPending}>บันทึก</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)} title="ยืนยันการลบ" description="คุณต้องการลบข้อมูลนี้หรือไม่?" onConfirm={() => { if (deleteId) { deleteMutation.mutate(deleteId); setDeleteId(null); } }} />
    </div>
  );
}