import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  gradient?: string;
}

export default function PageHeader({ title, subtitle, children, gradient }: PageHeaderProps) {
  const navigate = useNavigate();
  const gradientClass = gradient || "from-slate-950 via-slate-900 to-cyan-700";

  return (
    <div className={`relative overflow-hidden rounded-b-[2rem] bg-gradient-to-r ${gradientClass} px-4 py-6 md:px-8 md:py-8 shadow-2xl shadow-slate-950/20`}>
      <div className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-white/10 blur-xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white/90 hover:bg-white/20 transition-all"
          >
            <Home className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl lg:text-4xl truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-white/75 md:text-base">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
