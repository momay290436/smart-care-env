import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Calendar, MapPin, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [meterDisplayName, setMeterDisplayName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติการบันทึกข้อมูล
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => (await supabase.from('electricity_logs').select('*').order('created_at', { ascending: false })).data || [] 
  });

  // ฟังก์ชันสแกน QR Code ค้นหาแบบยืดหยุ่นเพื่อจับคู่กับหมายเลขเครื่อง
  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { fps: 10, qrbox: 250 }, 
        async (decodedText: string) => { 
          setIsScanning(false); 
          html5QrCode.stop(); 

          // 1. ทำความสะอาดข้อความ ตัดช่องว่าง แปลงเป็นตัวพิมพ์เล็ก
          const rawText = decodedText.trim().toLowerCase();
          
          // 2. แกะเอาเฉพาะหมายเลขเครื่องออกมา (กรณีสแกนเจอรูปแบบ "001.lovable.com" จะดึงแค่ "001")
          const extractedSerial = rawText.split('.')[0];

          // 3. ยิง Query ตรวจสอบข้อมูลแบบยืดหยุ่นครอบคลุมทุกคอลัมน์
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`serial_number.eq."${extractedSerial}",serial_number.eq."${rawText}",qr_url.eq."${rawText}",location_code.eq."${rawText}"`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error("Error fetching meter:", error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" });
            return;
          }

          if (meterData) {
            setSelectedMeterId(meterData.id);
            setMeterDisplayName(`${meterData.meter_name} (S/N: ${meterData.serial_number || 'ไม่มีข้อมูล'})`);
            toast({ title: "พบข้อมูลสถานที่", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('ไม่พบข้อมูลสถานที่นี้ในระบบ');
            toast({ 
              variant: "destructive", 
              title: "ไม่พบข้อมูลในระบบ", 
              description: `ไม่พบสถานที่ที่ผูกกับรหัส: ${decodedText}` 
            });
          }
        }, 
        (err) => {}
      ).catch((err) => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // ฟังก์ชันบันทึกข้อมูลมิเตอร์ไฟฟ้า
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสสถานที่และระบุเลขมิเตอร์" });
      return;
    }

    try {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeterId) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const currentVal = parseFloat(currentValue);
      const units = Math.max(0, currentVal - prevVal);

      const cleanMeterName = meterDisplayName.split(' (S/N:')[0];

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: units,
        meter_name: cleanMeterName
      }]);

      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลสำเร็จ" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: err.message });
    }
  };

  // ฟังก์ชันบันทึกสถานที่ติดตั้งใหม่
  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.serial) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อสถานที่และหมายเลขเครื่องมิเตอร์" });
      return;
    }

    const cleanSerial = newMeter.serial.trim().toLowerCase();
    const autoQrUrl = `${cleanSerial}.lovable.com`;

    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code || cleanSerial, 
        serial_number: cleanSerial,
        qr_url: autoQrUrl
      }]);
      
      if (error) throw error;

      toast({ title: "เพิ่มสถานที่ใหม่สำเร็จ", description: `ตั้งค่า URL: ${autoQrUrl}` });
      setNewMeter({ name: '', code: '', serial: '' });
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
    <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-5xl">
      {/* ส่วนหัวแอปพลิเคชัน */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 text-center sm:text-left">ระบบบันทึกไฟฟ้า</h1>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button onClick={exportExcel} variant="outline" className="w-full text-xs sm:text-sm"><FileSpreadsheet className="mr-1 sm:mr-2 h-4 w-4"/> Export</Button>
          <Dialog>
            <DialogTrigger asChild><Button className="w-full text-xs sm:text-sm"><Plus className="mr-1 sm:mr-2 h-4 w-4" /> เพิ่มสถานที่</Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] sm:max-w-[425px] rounded-xl">
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งใหม่</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">ชื่อสถานที่</label>
                  <Input placeholder="เช่น ร้านค้าสมาน" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์</label>
                  <Input placeholder="เช่น 001" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium mb-1 block">รหัสภายใน (ไม่จำเป็น)</label>
                  <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                </div>
                <div className="bg-slate-50 p-2 rounded text-center border border-dashed border-slate-
