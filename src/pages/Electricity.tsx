import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับการสแกนและบันทึกค่ามิเตอร์
  const [selectedMeterId, setSelectedMeterId] = useState(''); // เก็บ ID จริงเพื่อใช้บันทึกลงฐานข้อมูล
  const [meterDisplayName, setMeterDisplayName] = useState(''); // เก็บชื่อสถานที่จริงเพื่อแสดงผลบนหน้าจอ
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับการเพิ่มจุดติดตั้งและรับรูป QR Code
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติรายการบันทึก พร้อมผูกดึงชื่อมิเตอร์จากตารางสัมพันธ์กัน
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => {
      const { data } = await supabase
        .from('electricity_logs')
        .select(`
          id,
          meter_id,
          current_value,
          previous_value,
          units_used,
          created_at,
          electricity_meters (
            meter_name
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // ฟังก์ชันเริ่มสแกนเนอร์ และค้นหาชื่อสถานที่จริงจากลิงก์ QR Code
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

          const rawText = decodedText.trim();

          // วิ่งไปค้นหาใน Database ว่า QR URL นี้ตรงกับจุดติดตั้งไหน
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .eq('qr_url', rawText)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error(error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการตรวจสอบฐานข้อมูล" });
            return;
          }

          if (meterData) {
            setSelectedMeterId(meterData.id); // บันทึก id แฝงไว้ใช้ผูกตอนกดบันทึก log
            setMeterDisplayName(meterData.meter_name); // นำชื่อสถานที่จริงมาแปะแทนตัวลิงก์
            toast({ title: "เชื่อมต่อสถานที่สำเร็จ", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูลในระบบ", description: `ลิงก์ QR นี้ยังไม่ได้ผูกกับสถานที่ใดๆ: ${rawText}` });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // ฟังก์ชันบันทึกข้อมูลมิเตอร์ (แก้ไข: ถอดคอลัมน์ units_used ออกเพื่อให้ DB คำนวณแบบ DEFAULT อัตโนมัติ)
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกน QR สถานที่ และระบุเลขมิเตอร์ปัจจุบัน" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);

      // 1. ค้นหาประวัติบันทึกล่าสุดของมิเตอร์ตัวนี้เพื่อดึงเลขครั้งก่อนหน้ามาบันทึกคู่กัน
      const { data: lastLog, error: fetchError } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const prevVal = lastLog?.current_value || 0;

      if (currentVal < prevVal) {
        toast({ variant: "destructive", title: "ข้อมูลไม่ถูกต้อง", description: `เลขมิเตอร์ปัจจุบันค่าน้อยกว่าเลขมิเตอร์ครั้งก่อนหน้า (${prevVal})` });
        return;
      }

      // 2. บันทึกข้อมูลลงใน Table electricity_logs (ไม่ส่งคอลัมน์ units_used เพื่อแก้ปัญหา Database ล็อกค่า)
      const { error: insertError } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal
      }]);

      if (insertError) throw insertError;
      
      toast({ title: "บันทึกประวัติสำเร็จ", description: "ระบบบันทึกค่าและคำนวณหน่วยใช้ไฟให้อัตโนมัติแล้ว" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: err.message });
    }
  };

  // ฟังก์ชันสร้างสถานที่ใหม่และออกลิงก์สำหรับ QR code สำเร็จรูป
  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.serial) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อสถานที่และหมายเลขเครื่องมิเตอร์" });
      return;
    }

    const cleanSerial = newMeter.serial.trim().toLowerCase();
    const autoQrUrl = `${cleanSerial}.lovable.com`;

    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code || cleanSerial, 
        qr_url: autoQrUrl
      }]);
      
      if (error) throw error;

      // สร้างสตรีมลิงก์รูปภาพ QR Code ด้วย API ทันที
      const qrCodeImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(autoQrUrl)}`;
      setGeneratedQrUrl(qrCodeImgApi);

      toast({ title: "เพิ่มสถานที่สำเร็จ", description: "ระบบสร้างรหัส QR สั่งดาวน์โหลดภาพได้ด้านล่าง" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มจุดติดตั้งล้มเหลว", description: err.message });
    }
  };

  // ฟังก์ชันสั่งดาวน์โหลดภาพคิวอาร์โค้ดมาลงเครื่องปลายทาง
  const downloadQrCode = async () => {
    if (!generatedQrUrl) return;
    try {
      const response = await fetch(generatedQrUrl);
      const blob = await response.blob();
      const blobURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobURL;
      link.download = `QR_${newMeter.name || 'meter'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setNewMeter({ name: '', code: '', serial: '', qr_url: '' });
      setGeneratedQrUrl('');
    } catch (error) {
      toast({ variant: "destructive", title: "ดาวน์โหลดผิดพลาด", description: "กรุณาลองใหม่อีกครั้ง" });
    }
  };

  const exportExcel = () => {
    const flattenLogs = logs.map((log: any) => ({
      'วัน-เวลา': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูลจุดติดตั้ง',
      'เลขมิเตอร์ครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ล่าสุด': log.current_value,
      'จำนวนหน่วยไฟที่ใช้ (สุทธิ)': log.units_used
    }));
    const ws = XLSX.utils.json_to_sheet(flattenLogs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Electricity_Logs");
    XLSX.writeFile(wb, "Electricity_Report.xlsx");
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-xl sm
