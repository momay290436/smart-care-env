import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeter, setSelectedMeter] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => (await supabase.from('electricity_logs').select('*')).data || [] 
  });

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        (text: string) => { 
          setSelectedMeter(text); 
          setIsScanning(false); 
          html5QrCode.stop(); 
        }, 
        () => {}
      ).catch(() => {
        setIsScanning(false);
      });
    }, 500);
  };

  // 1. ฟังก์ชันบันทึกข้อมูล
  const handleSave = async () => {
    if (!selectedMeter || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและใส่เลขมิเตอร์" });
      return;
    }

    try {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_name', selectedMeter)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const currentVal = parseFloat(currentValue);

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_name: selectedMeter,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: currentVal - prevVal,
      }]);

      if (error) throw error;
      toast({ title: "บันทึกสำเร็จ" });
      setCurrentValue('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: "ตรวจสอบตาราง Database ว่ามีคอลัมน์ครบไหม" });
    }
  };

  // 2. ฟังก์ชันบันทึกสถานที่ใหม่ลงฐานข้อมูล
  const handleSaveMeter = async () => {
    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code,
        serial_number: newMeter.serial,
        qr_url: newMeter.qr_url 
      }]);
      
      if (error) throw error;
      
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
      setNewMeter({ name: '', code: '', serial: '', qr_url: '' });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "History.xlsx");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ระบบบันทึกไฟฟ้า</h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2"/> Export</Button>
