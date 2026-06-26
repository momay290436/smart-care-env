import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";

// Interface สำหรับข้อมูลขยะติดเชื้อ เพื่อป้องกัน TypeScript Error
interface InfectiousRow {
  id?: string;
  health_center_name: string;
  sharp_waste_kg: string;
  non_sharp_waste_kg: string;
  delivered_by: string;
  source_type: string;
  bottle_count: string;
}

const DEFAULT_WASTE_TYPES: Record<string, { label: string; color: string; chartColor: string }> = {
  general: { label: "ขยะทั่วไป", color: "bg-slate-200 text-slate-800 border-slate-300", chartColor: "#4C6085" },
  organic: { label: "ขยะเปียก", color: "bg-emerald-100 text-emerald-900 border-emerald-200", chartColor: "#36F1CD" },
  infectious: { label: "ขยะติดเชื้อ", color: "bg-red-200 text-red-900 border-red-300", chartColor: "#F38181" },
  recycle: { label: "ขยะรีไซเคิล", color: "bg-emerald-200 text-emerald-900 border-emerald-300", chartColor: "#E2AF90" },
  hazardous: { label: "ขยะอันตราย", color: "bg-amber-200 text-amber-900 border-amber-300", chartColor: "#4C6085" },
};

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  const [typesMap, setTypesMap] = useState(DEFAULT_WASTE_TYPES);
  const [showForm, setShowForm] = useState(false);
  const [wasteType, setWasteType] = useState("general");
  const [weight, setWeight] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // ฟังก์ชัน empty สำหรับสร้างแถวใหม่
  const emptyInfRow = (): InfectiousRow => ({ 
    id: undefined, health_center_name: "", sharp_waste_kg: "", non_sharp_waste_kg: "", delivered_by: "", source_type: "", bottle_count: "" 
  });
  
  const [infRows, setInfRows] = useState<InfectiousRow[]>([emptyInfRow()]);

  // ดึงข้อมูล
  const { data: logs = [] } = useQuery({
    queryKey: ["waste-logs"],
    queryFn: async () => {
      const { data } = await supabase.from("waste_logs").select("*, departments(name)").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const createLog = useMutation({
    mutationFn: async () => {
      const w = parseFloat(weight);
      const payload = {
        waste_type: wasteType,
        weight: w,
        department_id: profile?.department_id || null,
        recorded_by: user?.id,
        recorded_by_name: profile?.full_name || "ผู้ใช้งาน",
      };
      
      const { error } = await supabase.from("waste_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["waste-logs"] });
      setShowForm(false);
      setWeight("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filteredLogs = useMemo(() => {
    return logs.filter((log: any) => {
      if (filterType !== "all" && log.waste_type !== filterType) return false;
      return true;
    });
  }, [logs, filterType]);

  return (
    <div className="space-y-5">
      <PageHeader title="จัดการข้อมูลขยะ" subtitle="บันทึกและจัดการข้อมูลขยะ">
        <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" /> เพิ่มรายการ
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-2">วันที่</th>
                  <th className="p-2">ประเภท</th>
                  <th className="p-2 text-right">น้ำหนัก</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log: any) => (
                  <tr key={log.id} className="border-b">
                    <td className="p-2">{format(new Date(log.created_at), "d/M/yy")}</td>
                    <td className="p-2">{typesMap[log.waste_type]?.label || log.waste_type}</td>
                    <td className="p-2 text-right">{log.weight} กก.</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>บันทึกน้ำหนักขยะ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input type="number" placeholder="น้ำหนัก (กก.)" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <Button className="w-full" onClick={() => createLog.mutate()}>บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
