import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, BarChart3, Wrench, Trash2, Shield, Map, FlaskConical, Search, ChevronRight, Clipboard, Droplets } from "lucide-react";

const menuCards = [
  { path: "/dashboard", label: "แดชบอร์ด", desc: "ภาพรวมสถิติการใช้งาน กราฟรายวัน/เดือน และรายงานสรุป", icon: BarChart3, borderColor: "border-t-emerald-500", iconBg: "bg-emerald-500", statusDot: "bg-emerald-400", statusText: "ภาพรวมทั้งหมด", badgeKey: null },
  { path: "/5s-hub", label: "5ส.", desc: "ระบบตรวจ 5ส ปฏิทินกำหนดการ และรายงานผลการตรวจ", icon: Clipboard, borderColor: "border-t-teal-500", iconBg: "bg-teal-500", statusDot: "bg-teal-400", statusText: "พร้อมตรวจ", badgeKey: "audits" },
  { path: "/maintenance-hub", label: "ระบบซ่อมบำรุง", desc: "แจ้งซ่อม ติดตามสถานะ และจัดการงานซ่อมบำรุง", icon: Wrench, borderColor: "border-t-orange-500", iconBg: "bg-orange-500", statusDot: "bg-orange-400", statusText: "ติดตามงาน", badgeKey: "tickets" },
  { path: "/waste", label: "จัดการข้อมูลขยะ", desc: "บันทึก วิเคราะห์ และคำนวณต้นทุนการจัดการขยะ", icon: Trash2, borderColor: "border-t-rose-500", iconBg: "bg-rose-500", statusDot: "bg-rose-400", statusText: "บันทึกข้อมูล", badgeKey: "waste" },
  { path: "/safety-hub", label: "ความปลอดภัย", desc: "ตรวจถังดับเพลิง แผนที่หนีไฟ และระบบอพยพ", icon: Shield, borderColor: "border-t-red-500", iconBg: "bg-red-500", statusDot: "bg-red-400", statusText: "ระบบพร้อม", badgeKey: "fireChecks" },
  { path: "/map-hub", label: "แผนที่และนำทาง", desc: "แผนที่อาคาร นำทาง และจัดการเส้นทาง", icon: Map, borderColor: "border-t-violet-500", iconBg: "bg-violet-500", statusDot: "bg-violet-400", statusText: "ใช้งานได้ทันที", badgeKey: null },
  { path: "/hazmat", label: "คลัง HAZMAT", desc: "จัดการวัตถุอันตราย สารเคมี และ SDS", icon: FlaskConical, borderColor: "border-t-amber-500", iconBg: "bg-amber-500", statusDot: "bg-amber-400", statusText: "คลังสารเคมี", badgeKey: "chemicals" },
  { path: "/env-round", label: "ENV Round", desc: "เดินตรวจสิ่งแวดล้อมและความปลอดภัยประจำจุด", icon: Search, borderColor: "border-t-cyan-500", iconBg: "bg-cyan-500", statusDot: "bg-cyan-400", statusText: "เดินตรวจ", badgeKey: "envRounds" },
  { path: "/water", label: "ระบบจัดการน้ำประปา", desc: "ตรวจคุณภาพน้ำ มิเตอร์น้ำ และระบบ FMS ตามมาตรฐาน สรพ.", icon: Droplets, borderColor: "border-t-blue-500", iconBg: "bg-blue-500", statusDot: "bg-blue-400", statusText: "Water & FMS", badgeKey: null },
];

export default function HomePage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();

  const { data: badges } = useQuery({
    queryKey: ["home-badges"],
    queryFn: async () => {
      const [audits, tickets, waste, fireChecks, chemicals, envRounds] = await Promise.all([
        supabase.from("audit_5s").select("id", { count: "exact", head: true }),
        supabase.from("maintenance_tickets").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("waste_logs").select("id", { count: "exact", head: true }),
        supabase.from("fire_extinguisher_checks").select("id", { count: "exact", head: true }),
        supabase.from("chemicals").select("id", { count: "exact", head: true }),
        supabase.from("env_rounds").select("id", { count: "exact", head: true }),
      ]);
      return { audits: audits.count || 0, tickets: tickets.count || 0, waste: waste.count || 0, fireChecks: fireChecks.count || 0, chemicals: chemicals.count || 0, envRounds: envRounds.count || 0 };
    },
    staleTime: 30000,
  });

  // Fetch user permissions
  const { data: userPermissions } = useQuery({
    queryKey: ["user-page-permissions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("page_permissions").select("page_key").eq("user_id", user.id);
      return data?.map((p) => p.page_key) || [];
    },
    enabled: !!user,
  });

  // Filter cards based on permissions - admin sees all, others see only permitted
  const visibleCards = menuCards.filter((card) => {
    if (isAdmin) return true;
    if (!userPermissions) return false;
    return userPermissions.includes(card.path);
  });

  return (
    <div className="pb-6">
      {/* Hero Section */}
      <div className="relative -mx-4 -mt-4 px-4 sm:px-6 pt-8 sm:pt-10 pb-14 sm:pb-16 bg-gradient-to-br from-[hsl(195,80%,25%)] via-[hsl(187,75%,30%)] to-[hsl(170,60%,35%)] overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4" />
        <div className="relative text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-white/90 mb-4">
            🏥 Smart Hospital Platform
          </span>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mt-3 leading-tight">
            ระบบจัดการ<br className="sm:hidden" />สิ่งแวดล้อม
          </h1>
          <p className="text-sm sm:text-base text-white/70 mt-2 font-medium">เลือกเมนูด้านล่างเพื่อเริ่มใช้งาน</p>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="-mt-8 sm:-mt-10 px-1 space-y-5">
        {visibleCards.length === 0 && !isAdmin && (
          <Card className="bg-white rounded-2xl shadow-elevated border-0 p-8 text-center">
            <p className="text-muted-foreground">ยังไม่มีสิทธิ์เข้าถึงเมนูใด กรุณาติดต่อผู้ดูแลระบบ</p>
          </Card>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {visibleCards.map((item, index) => {
            const Icon = item.icon;
            const badgeCount = item.badgeKey && badges ? (badges as any)[item.badgeKey] : null;
            return (
              <Card
                key={item.path}
                className={`group cursor-pointer border-t-4 ${item.borderColor} bg-white rounded-2xl shadow-elevated hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 animate-slide-up overflow-hidden border-0`}
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
                onClick={() => navigate(item.path)}
              >
                <div className="p-5 flex flex-col gap-4 h-full min-h-[180px] sm:min-h-[200px]">
                  <div className="flex items-center justify-between">
                    <div className={`w-14 h-14 sm:w-12 sm:h-12 rounded-2xl ${item.iconBg} flex items-center justify-center shadow-md`}>
                      <Icon className="h-7 w-7 sm:h-6 sm:w-6 text-white" />
                    </div>
                    {badgeCount !== null && badgeCount > 0 && (
                      <Badge className="bg-primary/10 text-primary border-0 rounded-full text-xs font-bold px-2.5">
                        {badgeCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-lg font-bold text-foreground leading-tight">{item.label}</p>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">{item.desc}</p>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${item.statusDot} animate-pulse`} />
                      <span className="text-xs text-muted-foreground font-medium">{item.statusText}</span>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Admin Card */}
        {isAdmin && (
          <Card
            className="group cursor-pointer border-t-4 border-t-pink-500 bg-white rounded-2xl shadow-elevated hover:shadow-[0_12px_36px_-8px_rgba(0,0,0,0.15)] transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 animate-slide-up overflow-hidden border-0"
            style={{ animationDelay: "500ms", animationFillMode: "both" }}
            onClick={() => navigate("/admin")}
          >
            <div className="p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-pink-500 flex items-center justify-center shadow-md flex-shrink-0">
                <Settings className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-base sm:text-lg font-bold text-foreground leading-tight">จัดการระบบ</p>
                  <span className="text-[10px] font-semibold bg-pink-100 text-pink-600 rounded-full px-2 py-0.5">Admin Only</span>
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">บริหารจัดการผู้ใช้ ข้อมูลครุภัณฑ์ และการตั้งค่าระบบทั้งหมด</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
