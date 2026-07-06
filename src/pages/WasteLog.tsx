import { useState, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectScrollUpButton, SelectScrollDownButton } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { format, startOfDay, startOfWeek, startOfMonth } from "date-fns";
import { th } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar, Area, AreaChart } from "recharts";
import PageHeader from "@/components/PageHeader";
import { Plus, Download, Pencil, Trash2, CalendarIcon } from "lucide-react";
import * as XLSX from "xlsx";

export default function WasteLog() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  
  // เพิ่ม State สำหรับ BOD
  const [bodValue, setBodValue] = useState(""); 
  
  const [typesMap, setTypesMap] = useState<Record<string, { label: string; color: string; chartColor: string }>>({});
  const [manageTypesOpen, setManageTypesOpen] = useState(false);
  const [newTypeKey, setNewTypeKey] = useState("");
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [wasteType, setWasteType] = useState("general");
  const [weight, setWeight] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [customFrom, setCustomFrom] = useState<Date | undefined>();
  const [customTo, setCustomTo] = useState<Date | undefined>();
  const [costPerKg, setCostPerKg] = useState<Record<string, number>>({});
  const [customDateTime, setCustomDateTime] = useState("");
  const [customRecorder, setCustomRecorder] = useState("");
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // ส่วนของการบันทึกข้อมูล (เพิ่ม bod_value เข้าไปใน payload)
  const createLog = useMutation({
    mutationFn: async () => {
      const payload: any = {
        waste_type: wasteType,
        weight: parseFloat(weight) || 0,
        bod_value: bodValue ? parseFloat(bodValue) : null, // เพิ่มค่า BOD ตรงนี้
        department_id: selectedDept || profile?.department_id || null,
        recorded_by: user?.id,
      };
      const { error } = await supabase.from("wastewater_inspection_logs").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("บันทึกสำเร็จ");
      queryClient.invalidateQueries({ queryKey: ["wastewater-logs"] });
      setShowForm(false);
      setWeight("");
      setBodValue(""); // รีเซ็ตค่า BOD
    },
  });

  // ใส่ส่วน Input ใน Dialog
  return (
    <div className="space-y-5">
      {/* ... โค้ดส่วนบนคงเดิม ... */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>บันทึกข้อมูล</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* ช่องกรอกน้ำหนัก */}
            <div className="space-y-1.5">
              <Label>น้ำหนัก/ปริมาณ</Label>
              <Input value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            {/* ช่องกรอก BOD ที่เพิ่มเข้ามาใหม่ */}
            <div className="space-y-1.5">
              <Label>ค่า BOD (mg/L)</Label>
              <Input 
                type="number" 
                step="0.1" 
                placeholder="กรอกค่า BOD" 
                value={bodValue} 
                onChange={(e) => setBodValue(e.target.value)} 
              />
            </div>
            <Button className="w-full" onClick={() => createLog.mutate()}>บันทึก</Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* ... โค้ดส่วนล่างคงเดิม ... */}
    </div>
  );
}
