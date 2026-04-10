import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Camera, QrCode, X } from "lucide-react";

interface EquipmentInfo {
  id: string;
  name: string;
  code: string;
  category_name: string | null;
  department_name: string | null;
}

export default function MaintenanceRequest() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const [equipment, setEquipment] = useState<EquipmentInfo | null>(null);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("normal");
  const [photo, setPhoto] = useState<File | null>(null);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const startScanner = useCallback(async () => {
    setScanning(true);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      
      // Small delay to ensure DOM element exists
      await new Promise(r => setTimeout(r, 100));
      
      if (!videoRef.current) return;
      
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText: string) => {
          // Extract code from URL pattern https://lovable.dev/qr/[code]
          const match = decodedText.match(/\/qr\/(.+)$/);
          const code = match ? match[1] : decodedText;
          
          await scanner.stop();
          scannerRef.current = null;
          setScanning(false);
          
          // Look up equipment
          const { data, error } = await supabase
            .from("equipment")
            .select("id, name, code, equipment_categories(name), departments(name)")
            .eq("code", code)
            .maybeSingle();

          if (error || !data) {
            toast.error("ไม่พบอุปกรณ์ในระบบ รหัส: " + code);
            return;
          }

          setEquipment({
            id: data.id,
            name: data.name,
            code: data.code,
            category_name: (data as any).equipment_categories?.name || null,
            department_name: (data as any).departments?.name || null,
          });
        },
        () => {} // ignore errors during scanning
      );
    } catch (err: any) {
      toast.error("ไม่สามารถเข้าถึงกล้องได้: " + err.message);
      setScanning(false);
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try { scannerRef.current.stop(); } catch {}
      }
    };
  }, []);

  const submitTicket = useMutation({
    mutationFn: async () => {
      if (!user || !equipment) throw new Error("ข้อมูลไม่ครบ");
      
      let photoUrl = null;
      if (photo) {
        const ext = photo.name.split(".").pop();
        const path = `repair/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("photos").upload(path, photo);
        if (error) throw error;
        const { data } = supabase.storage.from("photos").getPublicUrl(path);
        photoUrl = data.publicUrl;
      }

      // Find technician assigned to this category
      let assignedTechId = null;
      if (equipment.category_name) {
        const { data: eq } = await supabase
          .from("equipment")
          .select("category_id")
          .eq("id", equipment.id)
          .single();
        
        if (eq?.category_id) {
          const { data: tech } = await supabase
            .from("technicians")
            .select("id")
            .eq("category_id", eq.category_id)
            .limit(1)
            .maybeSingle();
          assignedTechId = tech?.id || null;
        }
      }

      const { error } = await supabase.from("repair_tickets").insert({
        equipment_id: equipment.id,
        description,
        priority,
        photo_url: photoUrl,
        created_by: user.id,
        assigned_technician_id: assignedTechId,
      });
      if (error) throw error;

      // Send LINE notification
      try {
        await supabase.functions.invoke("line-notify", {
          body: {
            message: `🔧 แจ้งซ่อมใหม่\nอุปกรณ์: ${equipment.name} (${equipment.code})\nอาการ: ${description}\nความเร่งด่วน: ${priority === "critical" ? "🔴 ด่วนมาก" : priority === "urgent" ? "🟡 ด่วน" : "🟢 ปกติ"}\nผู้แจ้ง: ${profile?.full_name}`,
          },
        });
      } catch {}
    },
    onSuccess: () => {
      toast.success("บันทึกแจ้งซ่อมสำเร็จ");
      setEquipment(null);
      setDescription("");
      setPriority("normal");
      setPhoto(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const priorityOptions = [
    { value: "normal", label: "ปกติ", color: "bg-emerald-100 text-emerald-700" },
    { value: "urgent", label: "ด่วน", color: "bg-amber-100 text-amber-700" },
    { value: "critical", label: "ด่วนมาก", color: "bg-red-100 text-red-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
        <h2 className="text-lg font-bold text-foreground">แจ้งซ่อม</h2>
      </div>

      {!equipment && !scanning && (
        <Card className="border-0 bg-blue-50">
          <CardContent className="flex flex-col items-center gap-4 py-10">
            <div className="bg-blue-400 h-16 w-16 rounded-2xl flex items-center justify-center">
              <QrCode className="h-8 w-8 text-foreground" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">สแกน QR Code อุปกรณ์</p>
              <p className="text-xs text-muted-foreground mt-1">กดปุ่มด้านล่างเพื่อเปิดกล้องสแกน</p>
            </div>
            <Button onClick={startScanner} className="gap-2">
              <Camera className="h-4 w-4" />
              เปิดกล้องสแกน
            </Button>
          </CardContent>
        </Card>
      )}

      {scanning && (
        <Card className="overflow-hidden border-0">
          <CardContent className="p-0 relative">
            <div id="qr-reader" ref={videoRef} className="w-full" />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={stopScanner}
            >
              <X className="h-4 w-4 mr-1" />
              ปิดกล้อง
            </Button>
          </CardContent>
        </Card>
      )}

      {equipment && (
        <div className="space-y-4 animate-fade-in">
          <Card className="border-0 bg-emerald-50">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">ข้อมูลอุปกรณ์</p>
                <Button variant="ghost" size="sm" onClick={() => setEquipment(null)} className="text-xs h-6">
                  สแกนใหม่
                </Button>
              </div>
              <p className="font-bold text-foreground">{equipment.name}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">รหัส: {equipment.code}</Badge>
                {equipment.category_name && <Badge variant="outline">{equipment.category_name}</Badge>}
                {equipment.department_name && <Badge variant="outline">{equipment.department_name}</Badge>}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label>อาการ / ปัญหาที่พบ</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="อธิบายอาการเสียหรือปัญหาที่พบ..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>ระดับความเร่งด่วน</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${p.color}`}>
                          {p.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">แนบรูปภาพ (ถ้ามี)</Label>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border-2 border-dashed border-border p-3 transition-colors hover:border-primary">
                  <Camera className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {photo ? photo.name.slice(0, 30) : "เลือกรูปภาพ"}
                  </span>
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setPhoto(e.target.files?.[0] || null)} />
                </label>
              </div>

              <Button
                className="w-full"
                onClick={() => submitTicket.mutate()}
                disabled={submitTicket.isPending || !description}
              >
                {submitTicket.isPending ? "กำลังบันทึก..." : "ส่งแจ้งซ่อม"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
