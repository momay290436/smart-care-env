import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckCircle2, Clock, Wrench, PackageCheck, CalendarIcon } from "lucide-react";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { exportToExcel } from "@/lib/exportExcel";
import { toast } from "sonner";

const statusSteps = [
  { key: "pending", label: "รอยืนยัน", icon: Clock },
  { key: "accepted", label: "รับงานแล้ว", icon: PackageCheck },
  { key: "in_progress", label: "กำลังซ่อม", icon: Wrench },
  { key: "completed", label: "เสร็จสิ้น", icon: CheckCircle2 },
];

const statusIndex: Record<string, number> = {
  pending: 0,
  accepted: 1,
  in_progress: 2,
  completed: 3,
};

const priorityColors: Record<string, string> = {
  normal: "bg-emerald-100 text-emerald-700",
  urgent: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const priorityLabels: Record<string, string> = {
  normal: "ปกติ",
  urgent: "ด่วน",
  critical: "ด่วนมาก",
};

export default function RepairStatus() {
  const navigate = useNavigate();
  const [filterDept, setFilterDept] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("*").order("name");
      return data || [];
    },
  });

  const { data: tickets } = useQuery({
    queryKey: ["repair-tickets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("repair_tickets")
        .select("*, equipment(name, code, department_id, departments(name), equipment_categories(name)), technicians(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
  });

  const filteredTickets = tickets?.filter((t: any) => {
    if (filterDept !== "all" && t.equipment?.department_id !== filterDept) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    const created = new Date(t.created_at);
    const now = new Date();
    if (filterPeriod === "day" && created < startOfDay(now)) return false;
    if (filterPeriod === "week" && created < startOfWeek(now, { weekStartsOn: 1 })) return false;
    if (filterPeriod === "month" && created < startOfMonth(now)) return false;
    if (filterPeriod === "custom" && customFrom && customTo) {
      if (created < startOfDay(customFrom) || created > new Date(startOfDay(customTo).getTime() + 86400000 - 1)) return false;
    }
    return true;
  }) || [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate("/")}>← กลับ</Button>
          <h2 className="text-lg font-bold text-foreground">ติดตามสถานะซ่อม</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => {
          exportToExcel(filteredTickets.map((t: any) => ({
            "วันที่แจ้ง": new Date(t.created_at).toLocaleDateString("th-TH"),
            "อุปกรณ์": t.equipment?.name || "-",
            "รหัส": t.equipment?.code || "-",
            "แผนก": t.equipment?.departments?.name || "-",
            "สถานะ": statusSteps.find(s => s.key === t.status)?.label || t.status,
            "ความเร่งด่วน": priorityLabels[t.priority] || t.priority,
            "ช่าง": t.technicians?.name || "-",
            "อาการ": t.description || "-",
          })), "repair-status", "สถานะซ่อม");
          toast.success("ส่งออก Excel สำเร็จ");
        }}>📥 Excel</Button>
      </div>

      {/* Filters */}
      <Card className="shadow-card">
        <CardContent className="p-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            <Select value={filterDept} onValueChange={setFilterDept}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue placeholder="แผนก" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกแผนก</SelectItem>
                {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                {statusSteps.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกระดับ</SelectItem>
                <SelectItem value="normal">ปกติ</SelectItem>
                <SelectItem value="urgent">ด่วน</SelectItem>
                <SelectItem value="critical">ด่วนมาก</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPeriod} onValueChange={setFilterPeriod}>
              <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทั้งหมด</SelectItem>
                <SelectItem value="day">วันนี้</SelectItem>
                <SelectItem value="week">สัปดาห์นี้</SelectItem>
                <SelectItem value="month">เดือนนี้</SelectItem>
                <SelectItem value="custom">เลือกวันที่</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filterPeriod === "custom" && (
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs h-8 w-36 justify-start", !customFrom && "text-slate-500")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customFrom ? format(customFrom, "d MMM yy", { locale: th }) : "วันเริ่มต้น"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customFrom} onSelect={setCustomFrom} disabled={(d) => d > new Date()} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("text-xs h-8 w-36 justify-start", !customTo && "text-slate-500")}>
                    <CalendarIcon className="mr-1 h-3 w-3" />
                    {customTo ? format(customTo, "d MMM yy", { locale: th }) : "วันสิ้นสุด"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customTo} onSelect={setCustomTo} disabled={(d) => d > new Date() || (customFrom ? d < customFrom : false)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <p className="text-xs text-muted-foreground">{filteredTickets.length} รายการ</p>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredTickets.map((t: any) => {
          const currentStep = statusIndex[t.status] ?? 0;
          return (
            <Card key={t.id} className="border-0 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-sm">{t.equipment?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      รหัส: {t.equipment?.code} • {t.equipment?.departments?.name}
                    </p>
                  </div>
                  <Badge className={priorityColors[t.priority] || ""} variant="secondary">
                    {priorityLabels[t.priority] || t.priority}
                  </Badge>
                </div>

                <p className="text-xs text-muted-foreground">{t.description}</p>

                {/* Timeline status tracker */}
                <div className="flex items-center gap-0 pt-2">
                  {statusSteps.map((step, i) => {
                    const StepIcon = step.icon;
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center transition-colors ${
                              isCurrent
                                ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                                : isActive
                                ? "bg-primary/80 text-primary-foreground"
                                : "bg-slate-700 text-muted-foreground"
                            }`}
                          >
                            <StepIcon className="h-4 w-4" />
                          </div>
                          <p className={`text-[10px] mt-1 text-center leading-tight ${isCurrent ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                            {step.label}
                          </p>
                        </div>
                        {i < statusSteps.length - 1 && (
                          <div className={`h-0.5 flex-1 -mt-4 ${i < currentStep ? "bg-primary" : "bg-muted"}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1">
                  <span>{new Date(t.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" })}</span>
                  {t.technicians?.name && <span>ช่าง: {t.technicians.name}</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {filteredTickets.length === 0 && (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center gap-2 py-10">
              <p className="text-sm text-muted-foreground">ไม่มีรายการซ่อมในช่วงที่เลือก</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
