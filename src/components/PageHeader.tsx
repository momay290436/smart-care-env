import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  const navigate = useNavigate();
  const gradientClass = "from-[hsl(195,80%,25%)] via-[hsl(187,75%,30%)] to-[hsl(170,60%,35%)]";

  return (
    <div className={`relative overflow-hidden rounded-b-[2rem] bg-gradient-to-r ${gradientClass} px-4 py-6 md:px-8 md:py-8 shadow-2xl shadow-slate-950/20`}>
      <div className="pointer-events-none absolute -top-12 -left-12 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 right-0 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-white/10 blur-xl" />
      <div className="pointer-events-none absolute inset-y-0 left-1/2 w-[48rem] -translate-x-1/2 rounded-full bg-white/5 blur-2xl" />

      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="h-11 w-11 rounded-full border border-white/15 bg-white/10 text-white/90 hover:bg-white/20 transition-all"
          >
            <Home className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold text-white tracking-tight sm:text-3xl lg:text-4xl truncate">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-white/80 md:text-base">{subtitle}</p>}
          </div>
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2 [&_button]:bg-white/10 [&_button]:text-white [&_button]:border-white/20 [&_button:hover]:bg-white/20 [&_button]:shadow-slate-950/10">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
