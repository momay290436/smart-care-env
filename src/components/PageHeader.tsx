interface PageHeaderProps {
  title: string;
  subtitle?: string;
  gradient?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, gradient, children }: PageHeaderProps) {
  const gradientClass = gradient ? `bg-gradient-to-r ${gradient}` : "bg-gradient-to-r from-[hsl(195,80%,25%)] via-[hsl(187,75%,30%)] to-[hsl(170,60%,38%)]";
  return (
    <div className={`relative rounded-3xl overflow-hidden ${gradientClass} p-4 md:p-8 shadow-2xl`}>
      {/* Decorative circles */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/8 rounded-full -translate-y-1/3 translate-x-1/2 pointer-events-none blur-xl" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/3 -translate-x-1/4 pointer-events-none blur-lg" />

      {/* Mobile: stacked layout */}
      <div className="relative flex flex-col gap-2.5 md:hidden">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold text-white tracking-tight leading-tight truncate">{title}</h1>
          {subtitle && <p className="text-[11px] text-white/70 mt-1 font-medium truncate">{subtitle}</p>}
        </div>
        {children && (
          <div className="flex flex-wrap items-center gap-2 [&_button]:bg-white/10 [&_button]:text-white [&_button]:border-white/20 [&_button:hover]:bg-white/20 [&_button]:shadow-slate-950/10">
            {children}
          </div>
        )}
      </div>

      {/* Desktop: side-by-side */}
      <div className="relative hidden md:flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-sm text-white/75 mt-1 font-medium truncate">{subtitle}</p>}
        </div>
        {children && <div className="flex items-center gap-2 flex-shrink-0">{children}</div>}
      </div>
    </div>
  );
}
