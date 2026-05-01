import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, LogOut, ClipboardCheck } from "lucide-react";

const PAGE_LABELS: Record<string, { label: string; emoji: string; color: string }> = {
  "/water-meter": { label: "บันทึกมิเตอร์น้ำ", emoji: "💧", color: "from-sky-500 to-blue-600" },
  "/water": { label: "ระบบจัดการน้ำประปา", emoji: "🚰", color: "from-cyan-500 to-teal-600" },
  "/5s": { label: "ตรวจ 5ส.", emoji: "✅", color: "from-emerald-500 to-teal-600" },
  "/5s-hub": { label: "5ส. Hub", emoji: "⭐", color: "from-teal-500 to-emerald-600" },
  "/maintenance": { label: "แจ้งซ่อม", emoji: "🔧", color: "from-orange-500 to-red-500" },
  "/repair-status": { label: "สถานะซ่อม", emoji: "📋", color: "from-amber-500 to-orange-500" },
  "/waste": { label: "บันทึกขยะ", emoji: "🗑️", color: "from-rose-500 to-pink-600" },
  "/hazmat": { label: "คลังสารเคมี", emoji: "⚗️", color: "from-amber-500 to-yellow-600" },
  "/fire-check": { label: "ตรวจถังดับเพลิง", emoji: "🧯", color: "from-red-500 to-rose-600" },
  "/env-round": { label: "ENV Round", emoji: "🌿", color: "from-cyan-500 to-emerald-500" },
};

export default function StaffShortcutHome() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ["staff-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("page_permissions").select("page_key").eq("user_id", user.id);
      return (data || []).map((p: any) => p.page_key);
    },
    enabled: !!user,
  });

  const shortcuts = (permissions || []).filter((k) => PAGE_LABELS[k]);

  return (
    <div className="-mx-3 md:-mx-4 -mt-4 md:-mt-6 min-h-[calc(100dvh-3rem)] bg-gradient-to-br from-sky-50 via-white to-emerald-50 px-4 pt-6 pb-10">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-6">
          <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-primary to-cyan-600 flex items-center justify-center shadow-lg mb-3">
            <ClipboardCheck className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground">สวัสดี, {profile?.full_name || "พนักงาน"}</h1>
          <p className="text-sm text-muted-foreground mt-1">เลือกรายการที่ต้องการบันทึก</p>
        </div>

        {isLoading ? (
          <div className="text-center py-10 text-muted-foreground">กำลังโหลด...</div>
        ) : shortcuts.length === 0 ? (
          <Card className="rounded-3xl p-8 text-center bg-white shadow-card">
            <div className="text-5xl mb-2">🔒</div>
            <p className="font-semibold text-foreground">ยังไม่ได้รับสิทธิ์บันทึกข้อมูล</p>
            <p className="text-sm text-muted-foreground mt-1">กรุณาติดต่อผู้ดูแลระบบ</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {shortcuts.map((key) => {
              const meta = PAGE_LABELS[key];
              return (
                <button
                  key={key}
                  onClick={() => navigate(key)}
                  className={`w-full text-left rounded-3xl p-5 bg-gradient-to-r ${meta.color} text-white shadow-elevated active:scale-[0.97] transition-all flex items-center gap-4 min-h-[96px]`}
                >
                  <div className="w-14 h-14 rounded-2xl bg-white/25 backdrop-blur-sm flex items-center justify-center text-3xl flex-shrink-0">
                    {meta.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xl font-extrabold leading-tight">{meta.label}</p>
                    <p className="text-xs text-white/80 mt-0.5">แตะเพื่อเริ่มบันทึก</p>
                  </div>
                  <ChevronRight className="h-7 w-7 text-white/90 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            className="text-muted-foreground rounded-2xl gap-2"
            onClick={async () => { await signOut(); navigate("/login"); }}
          >
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </Button>
        </div>
      </div>
    </div>
  );
}