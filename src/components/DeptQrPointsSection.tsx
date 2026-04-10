import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function DeptQrPointsSection({ departmentId, departmentName }: { departmentId: string; departmentName: string }) {
  const queryClient = useQueryClient();
  const [pointName, setPointName] = useState("");
  const [showQr, setShowQr] = useState<string | null>(null);

  const { data: points = [] } = useQuery({
    queryKey: ["dept-qr-points", departmentId],
    queryFn: async () => {
      const { data } = await supabase.from("department_qr_points").select("*").eq("department_id", departmentId).order("point_name");
      return data || [];
    },
  });

  const addPoint = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.from("department_qr_points").insert({
        department_id: departmentId,
        point_name: pointName,
      }).select().single();
      if (error) throw error;
      // Set qr_code_data to the point ID
      await supabase.from("department_qr_points").update({ qr_code_data: data.id }).eq("id", data.id);
    },
    onSuccess: () => {
      toast.success("เพิ่มจุดตรวจสำเร็จ");
      setPointName("");
      queryClient.invalidateQueries({ queryKey: ["dept-qr-points", departmentId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePoint = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("department_qr_points").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ลบจุดตรวจสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["dept-qr-points", departmentId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const downloadQR = (value: string, name: string) => {
    const svg = document.querySelector(`[data-qr-dept="${value}"]`) as SVGSVGElement | null;
    if (!svg) { toast.info("กรุณาสกรีนช็อต QR Code"); return; }
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 300; canvas.height = 300;
    const ctx = canvas.getContext("2d")!;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, 300, 300);
      ctx.drawImage(img, 0, 0, 300, 300);
      const a = document.createElement("a");
      a.download = `qr-5s-${name}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      <div className="flex items-center gap-2">
        <QrCode className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">จุดตรวจ 5ส. (QR Code)</p>
        <Badge variant="secondary" className="text-xs rounded-2xl">{points.length} จุด</Badge>
      </div>
      <div className="flex gap-2">
        <Input value={pointName} onChange={(e) => setPointName(e.target.value)} placeholder="ชื่อจุดตรวจ เช่น ห้องพยาบาล A" className="flex-1 h-10 rounded-2xl text-sm" />
        <Button size="sm" className="rounded-2xl gap-1 h-10" onClick={() => addPoint.mutate()} disabled={!pointName || addPoint.isPending}>
          <Plus className="h-3.5 w-3.5" /> เพิ่ม
        </Button>
      </div>
      {points.map((p: any) => (
        <div key={p.id} className="rounded-2xl bg-muted/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{p.point_name}</span>
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="rounded-2xl text-xs h-8" onClick={() => setShowQr(showQr === p.id ? null : p.id)}>
                <QrCode className="h-3.5 w-3.5 mr-1" /> QR
              </Button>
              <Button variant="ghost" size="sm" className="text-destructive rounded-2xl h-8 w-8 p-0" onClick={() => { if (confirm("ยืนยันลบจุดตรวจนี้?")) deletePoint.mutate(p.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {showQr === p.id && (
            <div className="text-center p-3 rounded-xl bg-white">
              <QRCodeSVG value={p.qr_code_data || p.id} size={140} className="mx-auto" data-qr-dept={p.qr_code_data || p.id} />
              <p className="text-xs text-muted-foreground mt-2">{departmentName} - {p.point_name}</p>
              <Button variant="link" size="sm" className="text-xs mt-1" onClick={() => downloadQR(p.qr_code_data || p.id, p.point_name)}>
                ดาวน์โหลด QR Code
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
