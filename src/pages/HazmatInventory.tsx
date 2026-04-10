import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { differenceInDays } from "date-fns";
import { GHS_PICTOGRAMS, CHEMICAL_CATEGORIES } from "@/components/ghs-pictograms";
import { exportToExcel } from "@/lib/exportExcel";
import PageHeader from "@/components/PageHeader";
import { Html5QrcodeScanner } from "html5-qrcode";
import { QRCodeSVG } from "qrcode.react";
import { Download, Search, Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

type Chemical = {
  id: string; name_th: string; name_en: string; category: string;
  storage_building: string; storage_floor: string; storage_room: string;
  unit: string; current_stock: number; min_stock: number;
  expiry_date: string | null; msds_url: string | null;
  ghs_pictograms: string[]; first_aid_info: string;
  qr_code_data: string | null; department_id: string | null;
  created_by: string; created_at: string; updated_at: string;
};

function getExpiryStatus(expiryDate: string | null) {
  if (!expiryDate) return { label: "ไม่ระบุ", variant: "secondary" as const };
  const days = differenceInDays(new Date(expiryDate), new Date());
  if (days < 0) return { label: "หมดอายุแล้ว", variant: "destructive" as const };
  if (days <= 30) return { label: `เหลือ ${days} วัน`, variant: "destructive" as const };
  if (days <= 60) return { label: `เหลือ ${days} วัน`, variant: "default" as const };
  return { label: "ปกติ", variant: "default" as const };
}

function QrScannerDialog({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (data: string) => void }) {
  useEffect(() => {
    if (!open) return;
    const scanner = new Html5QrcodeScanner("qr-reader-hazmat", { fps: 10, qrbox: { width: 250, height: 250 } }, false);
    scanner.render(
      (text) => { onResult(text); scanner.clear(); onClose(); },
      () => {}
    );
    return () => { try { scanner.clear(); } catch {} };
  }, [open]);

  if (!open) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-3xl">
        <DialogHeader><DialogTitle>สแกน QR Code สารเคมี</DialogTitle></DialogHeader>
        <div id="qr-reader-hazmat" className="w-full" />
      </DialogContent>
    </Dialog>
  );
}

function ChemicalQRCode({ chemical }: { chemical: Chemical }) {
  const qrValue = `${window.location.origin}/hazmat?chem=${chemical.id}`;

  const downloadQR = useCallback(() => {
    const svg = document.getElementById(`qr-${chemical.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 480;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, 400, 480);
      ctx.drawImage(img, 50, 20, 300, 300);
      ctx.fillStyle = "#000";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(chemical.name_th, 200, 350);
      if (chemical.name_en) { ctx.font = "14px sans-serif"; ctx.fillText(chemical.name_en, 200, 375); }
      ctx.font = "12px sans-serif";
      ctx.fillStyle = "#666";
      ctx.fillText(`ID: ${chemical.id.slice(0, 8)}`, 200, 400);
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url; a.download = `qr-${chemical.name_th}.png`; a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [chemical]);

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-secondary/30 rounded-2xl">
      <QRCodeSVG id={`qr-${chemical.id}`} value={qrValue} size={160} level="M" includeMargin />
      <Button variant="outline" size="sm" className="rounded-2xl gap-1.5" onClick={downloadQR}>
        <Download className="h-4 w-4" />
        ดาวน์โหลด QR
      </Button>
    </div>
  );
}

export default function HazmatInventory() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedChemical, setSelectedChemical] = useState<Chemical | null>(null);
  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<"in" | "out">("in");
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showQrScanner, setShowQrScanner] = useState(false);

  // Handle URL param for QR scan redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const chemId = params.get("chem");
    if (chemId && !selectedChemical) {
      supabase.from("chemicals").select("*").eq("id", chemId).single().then(({ data }) => {
        if (data) { setSelectedChemical(data as Chemical); setShowDetailDialog(true); }
      });
    }
  }, []);

  const { data: chemicals = [], isLoading } = useQuery({
    queryKey: ["chemicals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chemicals").select("*").order("name_th");
      if (error) throw error;
      return data as Chemical[];
    },
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return chemicals.filter((c) => {
      const matchSearch = !search || c.name_th.includes(search) || c.name_en.toLowerCase().includes(search.toLowerCase());
      const matchCat = categoryFilter === "all" || c.category === categoryFilter;
      return matchSearch && matchCat;
    });
  }, [chemicals, search, categoryFilter]);

  const expiringSoon = useMemo(() => chemicals.filter((c) => {
    if (!c.expiry_date) return false;
    const days = differenceInDays(new Date(c.expiry_date), new Date());
    return days >= 0 && days <= 60;
  }).length, [chemicals]);

  const lowStock = useMemo(() => chemicals.filter((c) => c.current_stock <= c.min_stock).length, [chemicals]);

  const handleQrResult = (data: string) => {
    // Try to extract chem ID from URL
    let chemId = data;
    try { const url = new URL(data); chemId = url.searchParams.get("chem") || data; } catch {}
    const found = chemicals.find(c => c.id === chemId || c.qr_code_data === data || c.name_th === data);
    if (found) {
      setSelectedChemical(found);
      setShowDetailDialog(true);
      toast.success(`พบสารเคมี: ${found.name_th}`);
    } else {
      toast.error("ไม่พบข้อมูลสารเคมีจาก QR Code นี้");
    }
  };

  const addChemicalMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const ghsPics = form.getAll("ghs_pictograms") as string[];
      const { data, error } = await supabase.from("chemicals").insert({
        name_th: form.get("name_th") as string,
        name_en: form.get("name_en") as string,
        category: form.get("category") as string,
        storage_building: form.get("storage_building") as string,
        storage_floor: form.get("storage_floor") as string,
        storage_room: form.get("storage_room") as string,
        unit: form.get("unit") as string,
        current_stock: Number(form.get("current_stock")),
        min_stock: Number(form.get("min_stock")),
        expiry_date: (form.get("expiry_date") as string) || null,
        first_aid_info: form.get("first_aid_info") as string,
        ghs_pictograms: ghsPics,
        department_id: (form.get("department_id") as string) || null,
        created_by: user!.id,
      }).select().single();
      if (error) throw error;
      // Auto-set qr_code_data to the chemical ID
      if (data) {
        await supabase.from("chemicals").update({ qr_code_data: data.id }).eq("id", data.id);
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chemicals"] });
      setShowAddDialog(false);
      toast.success("เพิ่มสารเคมีสำเร็จ (QR Code สร้างอัตโนมัติ)");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteChemical = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("chemical_transactions").delete().eq("chemical_id", id);
      const { error } = await supabase.from("chemicals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chemicals"] });
      toast.success("ลบสารเคมีสำเร็จ");
      setShowDetailDialog(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const transactionMutation = useMutation({
    mutationFn: async ({ chemicalId, type, quantity, notes }: { chemicalId: string; type: "in" | "out"; quantity: number; notes: string }) => {
      const { error: txError } = await supabase.from("chemical_transactions").insert({
        chemical_id: chemicalId, transaction_type: type, quantity, performed_by: user!.id, notes: notes || null,
      });
      if (txError) throw txError;
      const chem = chemicals.find((c) => c.id === chemicalId)!;
      const newStock = type === "in" ? chem.current_stock + quantity : chem.current_stock - quantity;
      const { error: updateError } = await supabase.from("chemicals").update({ current_stock: Math.max(0, newStock) }).eq("id", chemicalId);
      if (updateError) throw updateError;
      if (type === "out" && newStock <= chem.min_stock) {
        try {
          await supabase.functions.invoke("line-notify", {
            body: { message: `⚠️ คลัง HAZMAT: ${chem.name_th} เหลือ ${newStock} ${chem.unit} (ต่ำกว่าเกณฑ์ ${chem.min_stock})` },
          });
        } catch {}
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chemicals"] });
      setShowTransactionDialog(false);
      setSelectedChemical(null);
      toast.success(transactionType === "in" ? "รับเข้าสำเร็จ" : "เบิกจ่ายสำเร็จ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadMsdsMutation = useMutation({
    mutationFn: async ({ chemicalId, file }: { chemicalId: string; file: File }) => {
      const filePath = `msds/${chemicalId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from("photos").upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("photos").getPublicUrl(filePath);
      const { error } = await supabase.from("chemicals").update({ msds_url: publicUrl }).eq("id", chemicalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chemicals"] });
      toast.success("อัปโหลด MSDS สำเร็จ");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pb-6">
      <PageHeader title="Smart HAZMAT Inventory" subtitle="บริหารจัดการคลังวัตถุอันตรายและสารเคมี" gradient="from-amber-50/80 to-orange-50/80">
        <Button size="sm" variant="outline" className="rounded-2xl text-sm h-9 gap-1.5" onClick={() => setShowQrScanner(true)}>
          <Search className="h-4 w-4" /> สแกน QR
        </Button>
        <Button size="sm" variant="outline" className="rounded-2xl text-sm h-9 gap-1.5" onClick={() => {
          exportToExcel(filtered.map(c => ({
            "ชื่อ (ไทย)": c.name_th, "ชื่อ (อังกฤษ)": c.name_en,
            "หมวดหมู่": CHEMICAL_CATEGORIES.find(cat => cat.value === c.category)?.label || c.category,
            "คงเหลือ": c.current_stock, "หน่วย": c.unit, "ขั้นต่ำ": c.min_stock,
            "วันหมดอายุ": c.expiry_date || "-",
            "สถานที่": [c.storage_building, c.storage_floor, c.storage_room].filter(Boolean).join("/"),
          })), "hazmat-inventory", "คลังสารเคมี");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>
          <Download className="h-4 w-4" /> Excel
        </Button>
      </PageHeader>

      <QrScannerDialog open={showQrScanner} onClose={() => setShowQrScanner(false)} onResult={handleQrResult} />

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { value: chemicals.length, label: "รายการทั้งหมด", gradient: "from-blue-500 to-blue-400" },
          { value: expiringSoon, label: "ใกล้หมดอายุ", gradient: "from-amber-500 to-amber-400" },
          { value: lowStock, label: "สต็อกต่ำ", gradient: "from-red-500 to-red-400" },
        ].map((stat, i) => (
          <Card key={i} className="border border-slate-200 shadow-lg overflow-hidden animate-slide-up rounded-2xl bg-white" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-90`} />
            <CardContent className="p-4 text-center relative z-10">
              <p className="text-3xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-white/80">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 animate-fade-in">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input placeholder="ค้นหาสารเคมี..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-12 rounded-2xl border-0 shadow-card bg-card text-base" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36 h-12 rounded-2xl border-0 shadow-card text-sm"><SelectValue placeholder="หมวดหมู่" /></SelectTrigger>
          <SelectContent className="rounded-2xl">
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {CHEMICAL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Add Button */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 h-13 rounded-2xl text-base shadow-card">
            <Plus className="h-5 w-5" /> เพิ่มสารเคมีใหม่
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="text-lg">เพิ่มสารเคมีใหม่</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); addChemicalMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-sm">ชื่อ (ไทย) *</Label><Input name="name_th" required className="h-11 rounded-2xl" /></div>
              <div><Label className="text-sm">ชื่อ (อังกฤษ)</Label><Input name="name_en" className="h-11 rounded-2xl" /></div>
            </div>
            <div><Label className="text-sm">หมวดหมู่ *</Label>
              <select name="category" required className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm">
                {CHEMICAL_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-sm">ตึก</Label><Input name="storage_building" className="rounded-2xl" /></div>
              <div><Label className="text-sm">ชั้น</Label><Input name="storage_floor" className="rounded-2xl" /></div>
              <div><Label className="text-sm">ห้อง</Label><Input name="storage_room" className="rounded-2xl" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-sm">จำนวน</Label><Input name="current_stock" type="number" defaultValue={0} className="rounded-2xl" /></div>
              <div><Label className="text-sm">ขั้นต่ำ</Label><Input name="min_stock" type="number" defaultValue={0} className="rounded-2xl" /></div>
              <div><Label className="text-sm">หน่วย</Label><Input name="unit" defaultValue="ขวด" className="rounded-2xl" /></div>
            </div>
            <div><Label className="text-sm">วันหมดอายุ</Label><Input name="expiry_date" type="date" className="rounded-2xl" /></div>
            <div><Label className="text-sm">แผนก</Label>
              <select name="department_id" className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-sm">
                <option value="">- ไม่ระบุ -</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <Label className="text-sm">สัญลักษณ์ GHS</Label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {Object.entries(GHS_PICTOGRAMS).map(([key, ghs]) => (
                  <label key={key} className="flex items-center gap-1.5 rounded-2xl border p-2.5 text-sm cursor-pointer hover:bg-accent transition-colors">
                    <input type="checkbox" name="ghs_pictograms" value={key} className="rounded" />
                    <img src={ghs.src} alt={ghs.label} className="h-6 w-6" />
                    <span className="truncate">{ghs.labelTh}</span>
                  </label>
                ))}
              </div>
            </div>
            <div><Label className="text-sm">ข้อมูลปฐมพยาบาล</Label><Textarea name="first_aid_info" rows={2} className="rounded-2xl" /></div>
            <Button type="submit" className="w-full h-12 rounded-2xl text-base" disabled={addChemicalMutation.isPending}>
              {addChemicalMutation.isPending ? "กำลังบันทึก..." : "บันทึก"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Chemical List */}
      {isLoading ? (
        <p className="text-center text-muted-foreground py-8 text-base">กำลังโหลด...</p>
      ) : filtered.length === 0 ? (
        <Card className="border border-slate-200 shadow-lg rounded-2xl bg-white"><CardContent className="text-center py-12 text-slate-600 text-base">ไม่พบข้อมูลสารเคมี</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((chem, idx) => {
            const expiry = getExpiryStatus(chem.expiry_date);
            const isLow = chem.current_stock <= chem.min_stock;
            return (
              <Card key={chem.id} className={`border border-slate-200 shadow-lg overflow-hidden cursor-pointer hover:shadow-2xl transition-all duration-200 animate-slide-up rounded-2xl bg-white ${isLow ? "ring-1 ring-red-400" : ""}`} style={{ animationDelay: `${idx * 40}ms`, animationFillMode: 'both' }} onClick={() => { setSelectedChemical(chem); setShowDetailDialog(true); }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base text-foreground">{chem.name_th}</h3>
                        {chem.name_en && <span className="text-sm text-muted-foreground">({chem.name_en})</span>}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                        <Badge variant="secondary" className="text-xs rounded-2xl">
                          {CHEMICAL_CATEGORIES.find((c) => c.value === chem.category)?.label || chem.category}
                        </Badge>
                        <Badge variant={isLow ? "destructive" : "default"} className="text-xs rounded-2xl">
                          สต็อก: {chem.current_stock} {chem.unit}
                        </Badge>
                        {chem.expiry_date && <Badge variant={expiry.variant} className="text-xs rounded-2xl">{expiry.label}</Badge>}
                      </div>
                      {chem.ghs_pictograms.length > 0 && (
                        <div className="mt-2 flex gap-1">
                          {chem.ghs_pictograms.map((key) => {
                            const ghs = GHS_PICTOGRAMS[key];
                            return ghs ? <img key={key} src={ghs.src} alt={ghs.label} className="h-7 w-7" title={ghs.labelTh} /> : null;
                          })}
                        </div>
                      )}
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        {[chem.storage_building, chem.storage_floor, chem.storage_room].filter(Boolean).join(" / ") || "ไม่ระบุที่เก็บ"}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="outline" className="h-9 text-sm gap-1.5 rounded-2xl" onClick={() => { setSelectedChemical(chem); setTransactionType("in"); setShowTransactionDialog(true); }}>
                        <ArrowDownToLine className="h-3.5 w-3.5" /> รับเข้า
                      </Button>
                      <Button size="sm" variant="outline" className="h-9 text-sm gap-1.5 rounded-2xl" onClick={() => { setSelectedChemical(chem); setTransactionType("out"); setShowTransactionDialog(true); }}>
                        <ArrowUpFromLine className="h-3.5 w-3.5" /> เบิกจ่าย
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader><DialogTitle className="text-lg">รายละเอียดสารเคมี</DialogTitle></DialogHeader>
          {selectedChemical && (
            <div className="space-y-4 text-base">
              {/* QR Code Section */}
              <ChemicalQRCode chemical={selectedChemical} />
              
              <div className="space-y-2.5">
                <div className="flex justify-between"><span className="text-muted-foreground">ชื่อ (ไทย):</span><span className="font-bold text-foreground">{selectedChemical.name_th}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ชื่อ (อังกฤษ):</span><span className="text-foreground">{selectedChemical.name_en || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">หมวดหมู่:</span><span className="text-foreground">{CHEMICAL_CATEGORIES.find(c => c.value === selectedChemical.category)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">สต็อก:</span><span className="font-bold text-foreground">{selectedChemical.current_stock} {selectedChemical.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">ขั้นต่ำ:</span><span className="text-foreground">{selectedChemical.min_stock} {selectedChemical.unit}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">วันหมดอายุ:</span><span className="text-foreground">{selectedChemical.expiry_date || "-"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">สถานที่:</span><span className="text-foreground">{[selectedChemical.storage_building, selectedChemical.storage_floor, selectedChemical.storage_room].filter(Boolean).join(" / ") || "-"}</span></div>
              </div>
              {selectedChemical.ghs_pictograms.length > 0 && (
                <div>
                  <span className="text-muted-foreground text-sm">สัญลักษณ GHS:</span>
                  <div className="flex gap-2 mt-1">{selectedChemical.ghs_pictograms.map(k => { const g = GHS_PICTOGRAMS[k]; return g ? <img key={k} src={g.src} alt={g.label} className="h-9 w-9" /> : null; })}</div>
                </div>
              )}
              {selectedChemical.first_aid_info && (
                <div>
                  <span className="text-muted-foreground text-sm">ปฏิมพยาบาล:</span>
                  <p className="mt-1 whitespace-pre-wrap text-sm bg-destructive/5 p-3 rounded-2xl">{selectedChemical.first_aid_info}</p>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                {selectedChemical.msds_url ? (
                  <Button variant="outline" className="flex-1 rounded-2xl h-11" onClick={() => window.open(selectedChemical.msds_url!, "_blank")}>ดู MSDS</Button>
                ) : (
                  <label className="flex-1">
                    <Button variant="outline" className="w-full rounded-2xl h-11 pointer-events-none">อัปโหลด MSDS</Button>
                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) uploadMsdsMutation.mutate({ chemicalId: selectedChemical.id, file });
                    }} />
                  </label>
                )}
                {isAdmin && (
                  <Button variant="destructive" className="rounded-2xl h-11" onClick={() => { if (confirm("ยืนยันลบสารเคมี?")) deleteChemical.mutate(selectedChemical.id); }}>
                    ลบ
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Transaction Dialog */}
      <Dialog open={showTransactionDialog} onOpenChange={setShowTransactionDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              {transactionType === "in" ? <ArrowDownToLine className="h-5 w-5" /> : <ArrowUpFromLine className="h-5 w-5" />}
              {transactionType === "in" ? "รับเข้า" : "เบิกจ่าย"} - {selectedChemical?.name_th}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            transactionMutation.mutate({
              chemicalId: selectedChemical!.id, type: transactionType,
              quantity: Number(fd.get("quantity")), notes: fd.get("notes") as string,
            });
          }} className="space-y-4">
            <p className="text-base text-muted-foreground">คงเหลือปัจจุบัน: {selectedChemical?.current_stock} {selectedChemical?.unit}</p>
            <div><Label className="text-sm">จำนวน *</Label><Input name="quantity" type="number" min={1} required className="h-12 rounded-2xl text-base" /></div>
            <div><Label className="text-sm">หมายเหตุ</Label><Input name="notes" className="h-12 rounded-2xl" /></div>
            <Button type="submit" className="w-full h-12 rounded-2xl text-base" disabled={transactionMutation.isPending}>
              {transactionMutation.isPending ? "กำลังบันทึก..." : "ยืนยัน"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
