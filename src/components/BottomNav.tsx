import { useNavigate, useLocation } from "react-router-dom";
import { BarChart3, ClipboardCheck, Home, Wrench, Shield } from "lucide-react";

const navItems = [
  { path: "/", label: "หน้าหลัก", icon: Home },
  { path: "/dashboard", label: "แดชบอร์ด", icon: BarChart3 },
  { path: "/5s", label: "5ส", icon: ClipboardCheck },
  { path: "/maintenance-hub", label: "ซ่อมบำรุง", icon: Wrench },
  { path: "/safety-hub", label: "ความปลอดภัย", icon: Shield },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-white/95 backdrop-blur-md shadow-[0_-2px_10px_rgba(0,0,0,0.06)] md:hidden">
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 transition-all duration-200 ${
                active
                  ? "text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${active ? "stroke-[2.5]" : ""}`} />
              <span className={`text-[10px] leading-tight ${active ? "font-bold" : "font-medium"}`}>
                {item.label}
              </span>
              {active && (
                <div className="h-1 w-5 rounded-full bg-primary mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
