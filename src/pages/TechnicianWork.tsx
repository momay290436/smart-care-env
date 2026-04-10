import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CheckCircle2, Clock, Wrench, PackageCheck } from "lucide-react";
import { exportToExcel } from "@/lib/exportExcel";
import { useState } from "react";
import { Navigate } from "react-router-dom";

const priorityLabels: Record<string, string> = { normal: "ปกติ", urgent: "ด่วน", critical: "ด่วนมาก" };
const priorityColors: Record<string, string> = { normal: "bg-emerald-100 text-emerald-700", urgent: "bg-amber-100 text-amber-700", critical: "bg-red-100 text-red-700" };
const statusLabels: Record<string, string> = { pending: "รอยืนยัน", accepted: "รับงานแล้ว", in_progress: "กำลังซ่อม", completed: "เสร็จสิ้น" };

export default function TechnicianWork() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canAccess = role === "admin" || role === "technician";

  const { data: myTechProfile } = useQuery({
    queryKey: ["my-tech-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("technicians")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: tickets } = useQuery({
    queryKey: ["tech-tickets", myTechProfile?.id],
    queryFn: async () => {
      let query = supabase
        .from("repair_tickets")
        .select("*, equipment(name, code, departments(name), equipment_categories(name))")
        .order("created_at", { ascending: false });

      // If technician (not admin), only show assigned tickets
      if (role === "technician" && myTechProfile) {
        query = query.eq("assigned_technician_id", myTechProfile.id);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: role === "admin" || !!myTechProfile,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: any = { status };
      if (status === "accepted") updates.accepted_at = new Date().toISOString();
      if (status === "completed") updates.completed_at = new Date().toISOString();
      const { error } = await supabase.from("repair_tickets").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("อัปเดตสถานะสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["tech-tickets"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (!canAccess) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
          <h2 className="text-lg font-bold text-foreground">จัดการงานซ่อม</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          exportToExcel((tickets || []).map((t: any) => ({
            "วันที่แจ้ง": new Date(t.created_at).toLocaleDateString("th-TH"),
            "อุปกรณ์": t.equipment?.name || "-",
            "รหัส": t.equipment?.code || "-",
            "แผนก": t.equipment?.departments?.name || "-",
            "สถานะ": statusLabels[t.status] || t.status,
            "ความเร่งด่วน": priorityLabels[t.priority] || t.priority,
            "อาการ": t.description || "-",
          })), "technician-work", "งานซ่อม");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>📥 Excel</Button>
      </div>

      <div className="space-y-3">
        {tickets?.map((t: any) => (
          <Card key={t.id} className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-sm">{t.equipment?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    รหัส: {t.equipment?.code} • {t.equipment?.departments?.name}
                  </p>
                </div>
                <Badge className={priorityColors[t.priority] || ""} variant="secondary">
                  {priorityLabels[t.priority] || t.priority}
                </Badge>
              </div>

              <p className="text-xs">{t.description}</p>

              {t.photo_url && (
                <img src={t.photo_url} alt="repair" className="rounded-lg h-24 w-full object-cover" />
              )}

              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">
                  {new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                </span>
                <Select
                  value={t.status}
                  onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}
                >
                  <SelectTrigger className="h-7 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">รอยืนยัน</SelectItem>
                    <SelectItem value="accepted">รับงาน</SelectItem>
                    <SelectItem value="in_progress">กำลังซ่อม</SelectItem>
                    <SelectItem value="completed">เสร็จสิ้น</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
        {(!tickets || tickets.length === 0) && (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-10">
              <p className="text-sm text-muted-foreground">ยังไม่มีงานซ่อมที่รับผิดชอบ</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
