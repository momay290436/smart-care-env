import BackButton from "./BackButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  gradient?: string;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[hsl(195,80%,25%)] via-[hsl(187,75%,30%)] to-[hsl(170,60%,38%)] p-5 shadow-elevated">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-white/70 mt-0.5 font-medium">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
