import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { Flame, Shield, ChevronRight } from "lucide-react";

const items = [
  { path: "/fire-check", label: "ตรวจถังดับเพลิง", desc: "ตรวจสอบสภาพถังดับเพลิงประจำเดือน บันทึกแรงดัน และส่ง LINE แจ้งเตือน", borderColor: "border-t-red-500", iconBg: "bg-red-500", icon: Flame },
  { path: "/fire-safety", label: "Fire Safety", desc: "แผนที่ถังดับเพลิงในอาคาร เส้นทางหนีไฟ และปุ่ม SOS แจ้งเหตุฉุกเฉิน", borderColor: "border-t-orange-500", iconBg: "bg-orange-500", icon: Shield },
];

export default function SafetyHub() {
  const navigate = useNavigate();
  return (
    <div className="space-y-4 md:space-y-5 pb-6">
      <PageHeader title="ความปลอดภัย" subtitle="ระบบตรวจสอบความปลอดภัย" />
      {/* Mobile: full-width stacked cards. Desktop: 2-column */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        {items.map((item, index) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.path}
              className={`group cursor-pointer bg-white border-t-4 ${item.borderColor} shadow-card hover:shadow-elevated transition-all duration-300 active:scale-[0.97] hover:-translate-y-1 rounded-2xl overflow-hidden border-0 animate-slide-up`}
              style={{ animationDelay: `${index * 100}ms`, animationFillMode: "both" }}
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-5 md:p-6 flex items-center gap-4 min-h-[120px]">
                <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl ${item.iconBg} flex items-center justify-center shadow-md flex-shrink-0`}>
                  <Icon className="h-7 w-7 md:h-8 md:w-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base md:text-lg font-bold text-slate-800 leading-tight">{item.label}</p>
                  <p className="text-xs md:text-sm text-slate-500 mt-1 leading-relaxed line-clamp-2">{item.desc}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
