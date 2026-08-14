import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import { CalendarIcon, X } from "lucide-react";
import type { DateRange } from "react-day-picker";

const toStr = (d?: Date) => (d ? format(d, "yyyy-MM-dd") : "");
const toDate = (s?: string) => (s ? new Date(`${s}T00:00:00`) : undefined);
const label = (s?: string) => (s ? format(toDate(s)!, "d MMM yy", { locale: th }) : "");

export default function DateRangeFilter({
  from,
  to,
  onChange,
  className,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  className?: string;
}) {
  const range: DateRange | undefined = from || to ? { from: toDate(from), to: toDate(to) } : undefined;
  const text = from || to ? `${label(from) || "..."} - ${label(to) || "..."}` : "เลือกช่วงวันที่";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-10 rounded-2xl gap-2 justify-start font-normal bg-background",
              !from && !to && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {text}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 rounded-2xl" align="start">
          <Calendar
            mode="range"
            locale={th}
            defaultMonth={toDate(from) || new Date()}
            selected={range}
            onSelect={(r: DateRange | undefined) => onChange(toStr(r?.from), toStr(r?.to))}
            numberOfMonths={1}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      {(from || to) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-10 rounded-2xl px-2 text-muted-foreground"
          onClick={() => onChange("", "")}
          aria-label="ล้างตัวกรองวันที่"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
