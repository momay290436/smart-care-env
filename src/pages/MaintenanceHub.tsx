import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { FileText, BarChart3, Wrench, Settings } from "lucide-react";

export default function MaintenanceHub() {
  const navigate = useNavigate();
  const { isAdmin, isTechnician } = useAuth();

  const items = [
    { path: "/maintenance", label: "แจ้งซ่อม", desc: "สแกน QR Code เพื่อแจ้งซ่อมอุปกรณ์", borderColor: "border-t-amber-500", iconColor: "text-amber-600", icon: FileText },
    { path: "/repair-status", label: "ติดตามสถานะซ่อม", desc: "ติดตามขั้นตอนการซ่อมอุปกรณ์", borderColor: "border-t-sky-500", iconColor: "text-sky-600", icon: BarChart3 },
  ];
  if (isAdmin || isTechnician) items.push({ path: "/technician-work", label: "จัดการงานซ่อม", desc: "รับงานและอัปเดตสถานะซ่อม", borderColor: "border-t-orange-500", iconColor: "text-orange-600", icon: Wrench });
  if (isAdmin) items.push({ path: "/maintenance-admin", label: "จัดการระบบซ่อม", desc: "จัดการอุปกรณ์ ช่าง และสิทธิ์", borderColor: "border-t-rose-500", iconColor: "text-rose-600", icon: Settings });

  return (
    <div className="space-y-5">
      <PageHeader title="ระบบซ่อมบำรุง" subtitle="แจ้งซ่อม ติดตาม จัดการ" />
      <div className="grid grid-cols-2 gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card key={item.path} className={`group cursor-pointer bg-white border-t-4 ${item.borderColor} shadow-card hover:shadow-elevated transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 rounded-2xl overflow-hidden animate-slide-up`} style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }} onClick={() => navigate(item.path)}>
              <CardContent className="p-6 flex flex-col items-center text-center space-y-3 min-h-[140px] justify-center">
                <Icon className={`h-6 w-6 ${item.iconColor}`} />
                <p className="text-base font-bold text-slate-800">{item.label}</p>
                <p className="text-xs text-slate-500">{item.desc}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
