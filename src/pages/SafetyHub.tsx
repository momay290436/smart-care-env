import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { Flame, Shield } from "lucide-react";

const items = [
  { path: "/fire-check", label: "ตรวจถังดับเพลิง", desc: "ตรวจสอบสภาพถังดับเพลิง", borderColor: "border-t-red-500", iconColor: "text-red-600", icon: Flame },
  { path: "/fire-safety", label: "Fire Safety", desc: "แผนที่ถังดับเพลิง เส้นทางหนีไฟ SOS", borderColor: "border-t-orange-500", iconColor: "text-orange-600", icon: Shield },
];

export default function SafetyHub() {
  const navigate = useNavigate();
  return (
    <div className="space-y-5">
      <PageHeader title="ความปลอดภัย" subtitle="ระบบตรวจสอบความปลอดภัย" />
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
