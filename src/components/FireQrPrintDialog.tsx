import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Printer } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

type Loc = { id: string; name: string; building?: string | null; floor?: string | null };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  locations: Loc[];
}

const SIZES = {
  small: { label: "เล็ก (40mm)", qr: 90, w: "40mm", pad: "2mm", font: "9px" },
  medium: { label: "กลาง (60mm)", qr: 140, w: "60mm", pad: "3mm", font: "11px" },
  large: { label: "ใหญ่ (80mm)", qr: 200, w: "80mm", pad: "4mm", font: "14px" },
};

export default function FireQrPrintDialog({ open, onOpenChange, locations }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [size, setSize] = useState<keyof typeof SIZES>("medium");

  const filtered = useMemo(
    () => locations.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()) || (l.building || "").toLowerCase().includes(search.toLowerCase())),
    [locations, search]
  );

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((l) => l.id)));
  };

  const handlePrint = () => {
    const cfg = SIZES[size];
    const items = locations.filter((l) => selected.has(l.id));
    if (items.length === 0) return;
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) return;
    const baseUrl = window.location.origin;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>QR Stickers</title>
<style>
@page { margin: 5mm; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 0; }
.grid { display: flex; flex-wrap: wrap; gap: 4mm; }
.sticker { width: ${cfg.w}; padding: ${cfg.pad}; border: 1px dashed #999; border-radius: 8px; text-align: center; page-break-inside: avoid; background: white; }
.sticker .name { font-size: ${cfg.font}; font-weight: 700; margin-bottom: 2mm; word-break: break-word; line-height: 1.2; }
.sticker .loc { font-size: calc(${cfg.font} - 1px); color: #555; margin-top: 1mm; }
.sticker svg { display: block; margin: 0 auto; }
@media print { .sticker { border: 1px solid #ddd; } }
</style></head><body><div class="grid">${items.map((l) => {
  const url = `${baseUrl}/fire-info/${l.id}`;
  return `<div class="sticker">
    <div class="name">🧯 ${l.name}</div>
    <div id="qr-${l.id}"></div>
    <div class="loc">${l.building || ""}${l.floor ? " ชั้น " + l.floor : ""}</div>
  </div>`;
}).join("")}</div>
<script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
<script>
(function(){
  const items = ${JSON.stringify(items.map((l) => ({ id: l.id, url: `${baseUrl}/fire-info/${l.id}` })))};
  const size = ${cfg.qr};
  let done = 0;
  items.forEach((it) => {
    QRCode.toCanvas(document.createElement('canvas'), it.url, { width: size, margin: 1 }, function(err, canvas){
      if (!err) document.getElementById('qr-' + it.id).appendChild(canvas);
      done++;
      if (done === items.length) setTimeout(() => { window.print(); }, 300);
    });
  });
})();
</script></body></html>`;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] rounded-3xl flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" /> พิมพ์สติกเกอร์ QR ถังดับเพลิง
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหา..." className="pl-9 h-11 rounded-2xl" />
            </div>
            <Select value={size} onValueChange={(v) => setSize(v as keyof typeof SIZES)}>
              <SelectTrigger className="w-40 h-11 rounded-2xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SIZES) as Array<keyof typeof SIZES>).map((k) => (
                  <SelectItem key={k} value={k}>{SIZES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-sm">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={toggleAll}>
              {selected.size === filtered.length && filtered.length > 0 ? "ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
            </Button>
            <span className="text-muted-foreground">เลือกแล้ว <strong className="text-primary">{selected.size}</strong> / {filtered.length}</span>
          </div>
        </div>

        <ScrollArea className="flex-1 max-h-[40vh] border rounded-2xl">
          <div className="p-2 space-y-1">
            {filtered.map((l) => (
              <label key={l.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 cursor-pointer">
                <Checkbox checked={selected.has(l.id)} onCheckedChange={() => toggle(l.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{l.name}</p>
                  {(l.building || l.floor) && (
                    <p className="text-xs text-muted-foreground">{l.building} {l.floor && `· ชั้น ${l.floor}`}</p>
                  )}
                </div>
                {selected.has(l.id) && <QRCodeSVG value={`${window.location.origin}/fire-info/${l.id}`} size={40} />}
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">ไม่พบข้อมูล</p>
            )}
          </div>
        </ScrollArea>

        <Button className="w-full h-12 rounded-2xl gap-2" onClick={handlePrint} disabled={selected.size === 0}>
          <Printer className="h-4 w-4" /> พิมพ์ {selected.size} สติกเกอร์ ขนาด{SIZES[size].label}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
