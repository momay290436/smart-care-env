import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Droplet, Zap, Calendar, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับเก็บข้อมูลมิเตอร์ไฟและน้ำ
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); 
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับระบุช่วงวันที่เพื่อใช้กรองข้อมูลด้านบนตารางประวัติ
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // States สำหรับสร้างจุดติดตั้งและคิวอาร์โค้ด
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตรวจสอบความเป็นประเภทร้านค้าหรือไม่
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงหน้าจอขึ้นไปส่วนบนสุดทันทีเมื่อโหลดเข้าหน้าระบบไฟฟ้านี้
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ดึงประวัติการบันทึกทั้งหมด
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
          current_water_value,
          previous_water_value,
          created_at,
          electricity_meters (
            meter_name
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // 1. ตัวกรองข้อมูล (Filter Data) ตามช่วงวันที่เลือก
  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  // 2. คำนวณยอด KPI สรุปของเดือนปัจจุบัน (รองรับการแปลงปี พ.ศ. และ ค.ศ. อย่างปลอดภัย)
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (currentYear > 2500) currentYear -= 543; // ดักแปลงถ้าเครื่องผู้ใช้เป็นปี พ.ศ.
    const currentMonth = now.getMonth(); 

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      if (logYear > 2500) logYear -= 543; // แปลงให้เป็น ค.ศ. เท่ากันเพื่อเทียบค่า

      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        // รวมหน่วยไฟฟ้าที่ใช้ประจำงวด
        totalElectricUnits += log.units_used || 0;
        
        // รวมหน่วยค่าน้ำประจำงวด (ล่าสุด - ครั้งก่อน)
        if (log.current_water_value && log.previous_water_value) {
          const waterDiff = log.current_water_value - log.previous_water_value;
          if (waterDiff > 0) totalWaterUnits += waterDiff;
        }
      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      water: totalWaterUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

  // ฟังก์ชันสแกนคิวอาร์และตรวจสอบสิทธิ์สถานที่
  const startScanner = () => {
    setIsScanning(true);
    setCurrentWaterValue('');
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          aspectRatio: 1.0, // บังคับสัดส่วนช่องพรีวิวภาพกล้องเป็น 1:1 จัตุรัส
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.72); // ขนาดกล่องเล็งสีขาวกว้างยาวเท่ากัน 72%
            return { width: boxSize, height: boxSize };
          }
        }, 
        async (decodedText: string) => { 
          setIsScanning(false); 
          html5QrCode.stop(); 

          const rawText = decodedText.trim();
          const { data: meterData } = await supabase
            .from('electricity_meters')
            .select('*')
            .eq('qr_url', rawText)
            .limit(1)
            .maybeSingle();

          if (meterData) {
            setSelectedMeterId(meterData.id); 
            setMeterDisplayName(meterData.meter_name); 
            toast({ title: "เชื่อมต่อสำเร็จ", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูล", description: `ลิงก์ QR นี้ยังไม่ได้ผูกในระบบ: ${rawText}` });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // จัดเก็บข้อมูลลงฐานข้อมูล (แก้ไขโดยการเอาคอลัมน์ units_used ออก เพื่อป้องกันข้อผิดพลาดชนกับระบบฐานข้อมูล)
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและระบุเลขมิเตอร์ไฟ" });
      return;
    }

    if (isShop && !currentWaterValue) {
      toast({ variant: "destructive", title: "กรุณาระบุเลขมิเตอร์น้ำของร้านค้าด้วยครับ" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);

      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value, current_water_value')
        .eq('meter_id', selectedMeterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const prevWaterVal = lastLog?.current_water_value || 0;

      if (currentVal < prevVal) {
        toast({ variant: "destructive", title: "ข้อมูลผิดพลาด", description: `เลขไฟน้อยกว่าครั้งก่อน (${prevVal})` });
        return;
      }

      // นำคอลัมน์ units_used ออกจากชุดคำสั่ง เพื่อแก้ปัญหาตามรูปภาพที่ระบุ
      const insertData: any = {
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal
      };

      if (isShop) {
        const currentWaterVal = parseFloat(currentWaterValue);
        if (currentWaterVal < prevWaterVal) {
          toast({ variant: "destructive", title: "ข้อมูลผิดพลาด", description: `เลขน้ำน้อยกว่าครั้งก่อน (${prevWaterVal})` });
          return;
        }
        insertData.current_water_value = currentWaterVal;
        insertData.previous_water_value = prevWaterVal;
      }

      const { error } = await supabase.from('electricity_logs').insert([insertData]);
      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลเสร็จสิ้น" });
      setCurrentValue('');
      setCurrentWaterValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: err.message });
    }
  };

  // เพิ่มสถานที่ปฏิบัติงานใหม่
  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.serial) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อสถานที่และรหัสมิเตอร์" });
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

      const qrCodeImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(autoQrUrl)}`;
      setGeneratedQrUrl(qrCodeImgApi);
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
    }
  };

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
    } catch {
      toast({ variant: "destructive", title: "ดาวน์โหลดคิวอาร์ผิดพลาด" });
    }
  };

  // ฟังก์ชัน Export แยกหน้าแผ่นงาน (Tabs) ตามรูปแบบคำในวงเล็บ
  const exportExcel = () => {
    const formatLogItem = (log: any) => ({
      'วัน-เวลาที่จด': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูล',
      'เลขมิเตอร์ไฟครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ไฟล่าสุด': log.current_value,
      'จำนวนหน่วยไฟที่ใช้ประจำงวด (หน่วย)': log.units_used,
      'เลขมิเตอร์น้ำครั้งก่อน': log.previous_water_value || '-',
      'เลขมิเตอร์น้ำล่าสุด': log.current_water_value || '-',
      'จำนวนหน่วยน้ำที่ใช้ประจำงวด (หน่วย)': log.current_water_value && log.previous_water_value ? (log.current_water_value - log.previous_water_value) : '-'
    });

    const categories = [
      { key: 'ร้านค้า', label: 'ร้านค้า' },
      { key: 'บ้านพัก', label: 'บ้านพัก' },
      { key: 'แฟลต1', label: 'แฟลต1' },
      { key: 'แฟลต2', label: 'แฟลต2' },
      { key: 'แฟลต3', label: 'แฟลต3' },
      { key: 'แฟลต4', label: 'แฟลต4' }
    ];

    const wb = XLSX.utils.book_new();

    const allRecords = filteredLogs.map(formatLogItem);
    const wsAll = XLSX.utils.json_to_sheet(allRecords);
    XLSX.utils.book_append_sheet(wb, wsAll, "รวมทุกสถานที่");

    categories.forEach(category => {
      const filtered = filteredLogs.filter((log: any) => {
        const name = log.electricity_meters?.meter_name || '';
        return name.includes(`(${category.key})`);
      });

      const filteredRecords = filtered.map(formatLogItem);
      const wsFiltered = XLSX.utils.json_to_sheet(filteredRecords);
      XLSX.utils.book_append_sheet(wb, wsFiltered, category.label);
    });

    XLSX.writeFile(wb, "Meter_Comprehensive_Report.xlsx");
  };

  return (
    <div className="w-full max-w-full md:max-w-[100vw] px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-slate-50/50 min-h-screen box-border overflow-x-hidden">
      
      {/* ส่วนหัวของระบบหน้าเว็บ */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">ระบบบริหารจัดการมิเตอร์</h1>
          <p className="text-xs text-slate-500 mt-0.5">บันทึก ติดตาม และคัดแยกรายงานสถิติการใช้งานไฟฟ้าและน้ำประปา</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex gap-2">
          <Button onClick={exportExcel} variant="outline" className="w-full sm:w-auto text-xs sm:text-sm h-10 border-slate-200 text-slate-700 font-medium order-2 sm:order-1">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600"/> Export รายงาน
          </Button>
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:'', qr_url:''}); } }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto text-xs sm:text-sm h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm order-1 sm:order-2">
                <Plus className="mr-2 h-4 w-4" /> เพิ่มสถานที่ติดตั้ง
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[425px] rounded-2xl p-4 sm:p-6">
              <DialogHeader><DialogTitle className="text-base sm:text-lg">เพิ่มจุดติดตั้งและทำ QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">ชื่อสถานที่ (ใส่วงเล็บท้ายชื่อ เช่น สมชาย(ร้านค้า))</label>
                      <Input placeholder="เช่น สมชาย(ร้านค้า) หรือ อาคารA(แฟลต1)" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์</label>
                      <Input placeholder="กรอกรหัสเลขเครื่อง" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">รหัสภายใน (ถ้ามี)</label>
                      <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2 h-10 text-sm" onClick={handleSaveMeter}>บันทึกและสร้างคิวอาร์</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 space-y-4 text-center">
                    <span className="text-xs sm:text-sm font-semibold text-emerald-600">ระบบสร้างคิวอาร์สำเร็จ</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-40 h-40 object-contain" />
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center h-10 text-sm" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดคิวอาร์ (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ส่วนกล่องลงบันทึกค่างวดมิเตอร์ / กล้องสแกน (สี่เหลี่ยมจัตุรัสและปิดกล้องได้สมบูรณ์) */}
      <div className="w-full">
        <Card className="w-full shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-xs sm:text-sm font-
