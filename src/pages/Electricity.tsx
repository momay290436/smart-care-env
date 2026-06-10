import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, Plus, Download, Printer, Scan } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // แอดมินสร้างสถานที่
  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  // 1. ดึงข้อมูลผู้ใช้งานปัจจุบันที่ล็อกอิน
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fullName = user.user_metadata?.full_name || user.email || 'ผู้ใช้งานระบบ';
        setUserProfile({ id: user.id, name: fullName });
      }
    };
    getUser();
  }, []);

  // 2. Query ดึงจุดติดตั้งมิเตอร์ทั้งหมด
  const { data: meters = [] } = useQuery({
    queryKey: ['electricity_meters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('electricity_meters').select('*');
      if (error) throw error;
      return data;
    }
  });

  // 3. Query ดึงประวัติการบันทึก
  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('electricity_logs')
        .select(`
          *,
          electricity_meters (meter_name, location_code)
        `)
        .order('created_at', { ascending: false });
      
      if (dateRange.start) query = query.gte('created_at', dateRange.start);
      if (dateRange.end) query = query.lte('created_at', `${dateRange.end}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // 4. Mutation สำหรับเพิ่มสถานที่ใหม่ (Admin)
  const createMeterMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('electricity_meters').insert([
        { meter_name: newMeterName, location_code: newMeterCode }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_meters'] });
      toast({ title: "สำเร็จ", description: "เพิ่มจุดติดตั้งมิเตอร์ไฟฟ้าเรียบร้อยแล้ว" });
      setNewMeterName(''); setNewMeterCode('');
    }
  });

  // 5. Mutation สำหรับบันทึกค่ามิเตอร์ (User)
  const createLogMutation = useMutation({
    mutationFn: async () => {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeter)
        .order('created_at', { ascending: false })
        .limit(1);

      const prevVal = lastLog && lastLog.length > 0 ? lastLog[0].current_value : 0;
      const currVal = parseFloat(currentValue);

      if (currVal < prevVal) {
        throw new Error("เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าครั้งก่อนหน้า (" + prevVal + ")");
      }

      const { error } = await supabase.from('electricity_logs').insert([
        {
          meter_id: selectedMeter,
          current_value: currVal,
          previous_value: prevVal,
          recorded_by: userProfile?.id,
          recorded_by_name: userProfile?.name
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ", description: "ระบบคำนวณหน่วยไฟที่ใช้เรียบร้อย" });
      setCurrentValue('');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  });

  // ฟังก์ชัน Export Excel
  const exportToExcel = () => {
    const dataToExport = logs.map(log => ({
      'วันที่-เวลาที่บันทึก': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่/จุดติดตั้ง': log.electricity_meters?.meter_name || 'ไม่ระบุ',
      'รหัสสถานที่': log.electricity_meters?.location_code || '',
      'เลขมิเตอร์ครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ปัจจุบัน': log.current_value,
      'หน่วยที่ใช้จริง (Units)': log.units_used,
      'ผู้จดบันทึก': log.recorded_by_name || 'ไม่ระบุ'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Electricity Logs");
    XLSX.writeFile(workbook, `รายงานมิเตอร์ไฟฟ้า_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ✨ ฟังก์ชันพิมพ์ QR Code เวอร์ชันอัปเกรดสูงสุด: ใช้ iframe ในการโหลด และแปลงผลเป็น canvas/image เพื่อหลีกเลี่ยง CSP บล็อกรูปภาพภายนอก
  const printQRCode = (code: string, name: string) => {
    const targetUrl = `${window.location.origin}/electricity?code=${encodeURIComponent(code)}`;
    
    // สร้างตู้คอนเทนเนอร์ลับสำหรับเจนภาพ QR Code ภายในโครงสร้างเว็บ โดยใช้โครงสร้างรูปภาพข้อมูล
