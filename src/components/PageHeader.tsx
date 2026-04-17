import BackButton from "./BackButton";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  gradient?: string;
}

export default function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-[hsl(195,80%,25%)] via-[hsl(187,75%,30%)] to-[hsl(170,60%,38%)] p-3 md:p-5 shadow-elevated">
      {/* Decorative */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      {/* Mobile: stacked layout */}
      <div className="relative flex flex-col gap-2.5 md:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <BackButton />
          <div className="min-w-0 flex-1">
            <h1 className="text-base font-bold text-white tracking-tight leading-tight truncate">{title}</h1>
            {subtitle && <p className="text-[11px] text-white/70 mt-0.5 font-medium truncate">{subtitle}</p>}
          </div>
        </div>
        {children && (
          <div className="flex items-center gap-2 flex-wrap [&_button]:h-9 [&_button]:text-xs [&_button]:px-3">
            {children}
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="relative hidden md:flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BackButton />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-white tracking-tight truncate">{title}</h1>
            {subtitle && <p className="text-sm text-white/70 mt-0.5 font-medium truncate">{subtitle}</p>}
          </div>
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}
