import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle } from "lucide-react";

export default function FireInfo() {
  const { id } = useParams<{ id: string }>();

  const { data: location, isLoading } = useQuery({
    queryKey: ["fire-info", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("fire_extinguisher_locations")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: lastCheck } = useQuery({
    queryKey: ["fire-info-last-check", id],
    queryFn: async () => {
      if (!id || !location) return null;
      const { data, error } = await supabase
        .from("fire_extinguisher_checks")
        .select("*")
        .eq("location", id)
        .order("checked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!location,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">กำลังโหลดข้อมูล...</p>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-destructive">ไม่พบข้อมูลถังดับเพลิง</p>
      </div>
    );
  }

  const details = [
    { label: "ชื่อตำแหน่ง", value: location.name },
    { label: "อาคาร", value: location.building },
    { label: "ชั้น", value: location.floor },
    { label: "สีถัง", value: (location as any).color },
    { label: "ขนาด", value: (location as any).size },
    { label: "ชนิด", value: (location as any).extinguisher_type },
    { label: "ประเภทเชื้อเพลิง", value: (location as any).fuel_type },
  ];

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold text-foreground">🧯 ข้อมูลถังดับเพลิง</h1>
          <p className="text-sm text-muted-foreground mt-1">ข้อมูลปัจจุบัน ณ เวลาที่สแกน</p>
        </div>

        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            {details.map((d) => (
              d.value ? (
                <div key={d.label} className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{d.label}</span>
                  <Badge variant="outline" className="text-sm font-medium">{d.value}</Badge>
                </div>
              ) : null
            ))}
          </CardContent>
        </Card>

        {/* ผลตรวจสภาพครั้งล่าสุด */}
        <Card className="shadow-card">
          <CardContent className="p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground">📋 ผลตรวจสภาพครั้งล่าสุด</h2>
            {lastCheck ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">วันที่ตรวจ</span>
                  <Badge variant="outline" className="text-sm font-medium">
                    {new Date(lastCheck.checked_at).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">เวลาที่ตรวจ</span>
                  <Badge variant="outline" className="text-sm font-medium">
                    {new Date(lastCheck.checked_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                  </Badge>
                </div>
                {lastCheck.inspector_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">ผู้ตรวจ</span>
                    <Badge variant="outline" className="text-sm font-medium">{lastCheck.inspector_name}</Badge>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">สภาพภายนอก</span>
                  {lastCheck.condition_ok
                    ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle className="h-3 w-3" /> ปกติ</Badge>
                    : <Badge className="bg-red-100 text-red-800 gap-1"><XCircle className="h-3 w-3" /> ผิดปกติ</Badge>}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">มาตรวัดความดัน</span>
                  {lastCheck.pressure_ok
                    ? <Badge className="bg-green-100 text-green-800 gap-1"><CheckCircle className="h-3 w-3" /> ปกติ</Badge>
                    : <Badge className="bg-red-100 text-red-800 gap-1"><XCircle className="h-3 w-3" /> ผิดปกติ</Badge>}
                </div>
                {lastCheck.notes && (
                  <div className="pt-1 border-t">
                    <span className="text-xs text-muted-foreground">หมายเหตุ: {lastCheck.notes}</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">ยังไม่มีประวัติการตรวจ</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              วันที่สแกน: {new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })}
              {" "}
              {new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
