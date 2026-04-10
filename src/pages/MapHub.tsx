import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "@/components/PageHeader";
import { Navigation, MapPin, Settings } from "lucide-react";

export default function MapHub() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const items = [
    { path: "/wayfinding", label: "นำทางในโรงพยาบาล", desc: "ค้นหาแผนกและจุดบริการ", borderColor: "border-t-teal-500", iconColor: "text-teal-600", icon: Navigation },
    { path: "/map", label: "แผนที่โรงพยาบาล", desc: "แผนผังอาคารและพื้นที่", borderColor: "border-t-violet-500", iconColor: "text-violet-600", icon: MapPin },
  ];
  if (isAdmin) items.push({ path: "/wayfinding-admin", label: "จัดการเส้นทาง", desc: "กำหนด Node ถนน อาคาร บนแผนที่", borderColor: "border-t-indigo-500", iconColor: "text-indigo-600", icon: Settings });

  return (
    <div className="space-y-5">
      <PageHeader title="แผนที่และนำทาง" subtitle="แผนที่ นำทาง จัดการเส้นทาง" />
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
