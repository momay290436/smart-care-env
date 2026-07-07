import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Droplet, Zap, Calendar, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับบันทึกข้อมูลหลัก
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); 
  const [isScanning, setIsScanning] = useState(false);

  // เพิ่ม State สำหรับปฏิทินลงข้อมูลย้อนหลัง (ค่าเริ่มต้นเป็นวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD)
  const [recordDate, setRecordDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  // States พิเศษสำหรับจัดการข้อมูลครั้งแรกที่ดึงมาจากกระดาษ
  const [isFirstRecord, setIsFirstRecord] = useState(false);
  const [customPrevValue, setCustomPrevValue] = useState('');
  const [customPrevWaterValue, setCustomPrevWaterValue] = useState('');

  // States สำหรับระบบคัดกรองปฏิทิน
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // States สำหรับการลงทะเบียนเครื่องมิเตอร์ใหม่
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตัวแปรเช็กกลุ่มร้านค้า
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ดึงประวัติรายการทั้งหมดจาก Supabase
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

  // ระบบคัดกรองข้อมูลประวัติด้วยวันที่
  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  // คำนวณสรุปหน่วยประจำเดือนล่าสุด (รองรับปฏิทิน พ.ศ. / ค.ศ.)
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (currentYear > 2500) currentYear -= 543;
    const currentMonth = now.getMonth(); 

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      if (logYear > 2500) logYear -= 543;

      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        totalElectricUnits += log.units_used || 0;
        
        if (log.current_water_value && log.previous_water_value) {
          const waterDiff = log.current_water_value >= log.previous_water_value 
            ? log.current_water_value - log.previous_water_value 
            : (10000 - log.previous_water_value) + log.current_water_value;

          if (waterDiff > 0) {
            totalWaterUnits += waterDiff;
          }
        }
      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      water: totalWaterUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

  // สรุปข้อมูลรายเดือน สำหรับกราฟแนวโน้มการใช้ไฟฟ้า / น้ำ (ร้านค้า)
  const monthlyTrend = React.useMemo(() => {
    const map: Record<string, { key: string; label: string; electric: number; water: number; sortKey: number }> = {};
    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const d = new Date(log.created_at);
      let y = d.getFullYear();
      if (y > 2500) y -= 543;
      const m = d.getMonth();
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      if (!map[key]) {
        const monthName = new Date(y, m, 1).toLocaleString('th-TH', { month: 'short', year: '2-digit' });
        map[key] = { key, label: monthName, electric: 0, water: 0, sortKey: y * 12 + m };
      }
      map[key].electric += Number(log.units_used) || 0;
      if (log.current_water_value && log.previous_water_value) {
        const diff = log.current_water_value >= log.previous_water_value
          ? log.current_water_value - log.previous_water_value
          : (10000 - log.previous_water_value) + log.current_water_value;
        if (diff > 0) map[key].water += diff;
      }
    });
    return Object.values(map).sort((a, b) => a.sortKey - b.sortKey);
  }, [logs]);

  const trendKpi = React.useMemo(() => {
    if (monthlyTrend.length === 0) return { electricAvg: 0, waterAvg: 0, electricLast: 0, waterLast: 0, electricDelta: 0, waterDelta: 0 };
    const last = monthlyTrend[monthlyTrend.length - 1];
    const prev = monthlyTrend.length > 1 ? monthlyTrend[monthlyTrend.length - 2] : null;
    const eAvg = monthlyTrend.reduce((s, r) => s + r.electric, 0) / monthlyTrend.length;
    const wAvg = monthlyTrend.reduce((s, r) => s + r.water, 0) / monthlyTrend.length;
    return {
      electricAvg: Math.round(eAvg),
      waterAvg: Math.round(wAvg),
      electricLast: Math.round(last.electric),
      waterLast: Math.round(last.water),
      electricDelta: prev ? Math.round(last.electric - prev.electric) : 0,
      waterDelta: prev ? Math.round(last.water - prev.water) : 0,
    };
  }, [monthlyTrend]);

  // ฟังก์ชันวิเคราะห์ประวัติย้อนหลังของมิเตอร์เพื่อเปิดฟอร์มแก้เลขตั้งต้น
  const checkMeterHistory = async (meterId: string) => {
    try {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value, current_water_value')
        .eq('meter_id', meterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastLog) {
        setIsFirstRecord(true);
        setCustomPrevValue('0');
        setCustomPrevWaterValue('0');
      } else {
        setIsFirstRecord(false);
        setCustomPrevValue(lastLog.current_value.toString());
        setCustomPrevWaterValue(lastLog.current_water_value ? lastLog.current_water_value.toString() : '0');
      }
    } catch (err) {
      // Silently handle error to prevent build issues
    }
  };

  // เรียกใช้งานโมดูลกล้องเพื่อสแกน QR Code หน้างาน
  const startScanner = () => {
    setIsScanning(true);
    setCurrentWaterValue('');
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          aspectRatio: 1.0, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.72); 
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
            await checkMeterHistory(meterData.id);
            toast({ title: "เชื่อมต่อสำเร็จ", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูล", description: "ลิงก์คิวอาร์โค้ดนี้ยังไม่ได้ผูกในระบบ" });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดใช้งานกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // ดำเนินการบันทึกข้อมูลเข้าสู่ฐานข้อมูล
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและระบุเลขมิเตอร์ไฟ" });
      return;
    }

    if (isShop && !currentWaterValue) {
      toast({ variant: "destructive", title: "กรุณาระบุเลขมิเตอร์น้ำของร้านค้า" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);
      const prevVal = parseFloat(customPrevValue) || 0;

      const currentTimeStr = new Date().toTimeString().split(' ')[0]; 
      const finalCreatedAt = new Date(`${recordDate}T${currentTimeStr}`).toISOString();

     const insertData: any = {
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        created_at: finalCreatedAt 
      };

      if (isShop) {
        const currentWaterVal = parseFloat(currentWaterValue);
        const prevWaterVal = parseFloat(customPrevWaterValue) || 0;
        
        insertData.current_water_value = currentWaterVal;
        insertData.previous_water_value = prevWaterVal;
      }

      const { error } = await supabase.from('electricity_logs').insert([insertData]);
      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลสำเร็จเรียบร้อย" });
      setCurrentValue('');
      setCurrentWaterValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      setIsFirstRecord(false);
      
      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset * 60 * 1000));
      setRecordDate(localToday.toISOString().split('T')[0]);

      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการบันทึก", description: err.message });
    }
  };

  // เพิ่มจุดจดบันทึกตัวใหม่เข้าระบบ
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
      toast({ title: "เพิ่มจุดตรวจสอบสำเร็จ" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "การบันทึกจุดจดล้มเหลว", description: err.message });
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
      toast({ variant: "destructive", title: "ดาวน์โหลดรูปคิวอาร์โค้ดไม่สำเร็จ" });
    }
  };

  // ส่งออกไฟล์รายงานสรุปแยกหมวดหมู่ตามวงเล็บท้ายชื่อ
  const exportExcel = () => {
    const formatLogItem = (log: any) => ({
      'วัน-เวลาที่จด': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูล',
      'เลขมิเตอร์ไฟครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ไฟล่าสุด': log.current_value,
      'จำนวนหน่วยไฟที่ใช้ประจำงวด (หน่วย)': log.units_used,
      'เลขมิเตอร์น้ำครั้งก่อน': log.previous_water_value || '-',
      'เลขมิเตอร์น้ำล่าสุด': log.current_water_value || '-',
      'จำนวนหน่วยน้ำที่ใช้ประจำงวด (หน่วย)': log.current_water_value && log.previous_water_value ? (log.current_water_value >= log.previous_water_value ? log.current_water_value - log.previous_water_value : (10000 - log.previous_water_value) + log.current_water_value) : '-'
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

    // 3. แผ่นงาน "อื่นๆ" สำหรับสถานที่ที่ไม่ตรงกับวงเล็บประเภทใดๆ เลย (หรือไม่มีวงเล็บ)
    const othersFiltered = filteredLogs.filter((log: any) => {
      const name = log.electricity_meters?.meter_name || '';
      const hasMainCategory = categories.some(category => name.includes(`(${category.key})`));
      return !hasMainCategory;
    });

    const othersRecords = othersFiltered.map(formatLogItem);
    const wsOthers = XLSX.utils.json_to_sheet(othersRecords);
    XLSX.utils.book_append_sheet(wb, wsOthers, "อื่นๆ");

    XLSX.writeFile(wb, "Meter_Comprehensive_Report.xlsx");
  };

  return (
    <div className="max-w-7xl mx-auto w-full px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-slate-50/50 min-h-screen box-border overflow-x-hidden">
      
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

      {/* ส่วนกล่องลงบันทึกค่างวดมิเตอร์ / กล้องสแกน */}
      <div className="w-full">
        <Card className="w-full shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-500"/>ลงบันทึกค่างวดมิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 px-4 pb-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 sm:py-5 rounded-xl text-xs sm:text-sm font-bold shadow-sm active:scale-[0.98] transition-all">
                <Camera className="mr-2 h-4 w-4"/> เปิดกล้องสแกนคิวอาร์
              </Button>
            ) : (
              <div className="relative max-w-[320px] mx-auto aspect-square w-full border-4 border-indigo-500 rounded-2xl overflow-hidden shadow-md bg-black">
                <div id="reader" className="w-full h-full [&_video]:object-cover [&_video]:w-full [&_video]:h-full"></div>
                <Button 
                  onClick={() => setIsScanning(false)} 
                  className="absolute top-3 right-3 rounded-full h-8 w-8 p-0 z-50 shadow-md bg-rose-500 hover:bg-rose-600 transition-colors" 
                  size="sm" 
                  variant="destructive"
                >
                  <X className="h-4 w-4 text-white"/>
                </Button>
              </div>
            )}

            {/* ส่วนฟอร์มกรอกข้อมูลมิเตอร์ */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-100">
              
              {/* ปฏิทินสำหรับแอดมินเลือกบันทึกวันที่ย้อนหลัง */}
              <div className="space-y-1 md:col-span-2 bg-indigo-50/40 p-3 border border-indigo-100 rounded-xl">
                <label className="text-[11px] font-bold text-indigo-700 flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5"/> วันที่จดบันทึกข้อมูล (ปรับเปลี่ยนเพื่อลงข้อมูลย้อนหลังได้)
                </label>
                <Input 
                  type="date" 
                  value={recordDate} 
                  onChange={(e) => setRecordDate(e.target.value)} 
                  className="bg-white border-indigo-200 focus:ring-2 focus:ring-indigo-500 h-10 text-sm font-semibold" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500">สถานที่ปฏิบัติงานที่ตรวจจับได้</label>
                <Input value={meterDisplayName} placeholder="ชื่อสถานที่จากการสแกน" readOnly className="bg-white text-center font-bold text-slate-800 border-slate-200 h-10 text-sm" />
              </div>

              {/* บันทึกระบบไฟฟ้า */}
              <div className="p-3 bg-amber-50/40 border border-amber-100 rounded-xl space-y-2">
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1"><Zap className="h-3.5 w-3.5"/> ระบบบันทึกมิเตอร์ไฟฟ้า</span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-slate-500 block mb-0.5">เลขงวดก่อนหน้า</label>
                    <Input 
                      type="number" 
                      value={customPrevValue} 
                      onChange={(e) => setCustomPrevValue(e.target.value)} 
                      disabled={!isFirstRecord} 
                      className={isFirstRecord ? "text-center font-semibold h-9 text-xs bg-white border-amber-400 focus:ring-amber-500" : "text-center font-semibold h-9 text-xs text-slate-400 bg-slate-100"} 
                      placeholder="อิงตามระบบ"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-amber-600 block mb-0.5">เลขล่าสุด</label>
                    <Input type="number" value={currentValue} placeholder="ระบุเลขล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-xs font-bold border-slate-300 focus:ring-2 focus:ring-indigo-500 h-9 bg-white" />
                  </div>
                </div>
                {isFirstRecord && <p className="text-[9px] text-amber-600 font-medium">* บันทึกครั้งแรก: สามารถแก้ไขเลขงวดก่อนหน้าได้</p>}
              </div>

              {/* บันทึกระบบน้ำประปา (ถ้ามีวงเล็บคำว่าร้านค้าท้ายชื่อ) */}
              {isShop && (
                <div className="p-3 bg-blue-50/40 border border-blue-100 rounded-xl space-y-2 md:col-span-2">
                  <span className="text-[11px] font-bold text-blue-700 flex items-center gap-1"><Droplet className="h-3.5 w-3.5"/> ระบบบันทึกมิเตอร์น้ำประปา (เฉพาะร้านค้า)</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-medium text-slate-500 block mb-0.5">เลขงวดก่อนหน้า</label>
                      <Input 
                        type="number" 
                        value={customPrevWaterValue} 
                        onChange={(e) => setCustomPrevWaterValue(e.target.value)} 
                        disabled={!isFirstRecord} 
                        className={isFirstRecord ? "text-center font-semibold h-9 text-xs bg-white border-blue-400 focus:ring-blue-500" : "text-center font-semibold h-9 text-xs text-slate-400 bg-slate-100"} 
                        placeholder="อิงตามระบบ"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-blue-600 block mb-0.5">เลขล่าสุด</label>
                      <Input type="number" value={currentWaterValue} placeholder="ระบุเลขล่าสุด" onChange={(e) => setCurrentWaterValue(e.target.value)} className="text-center text-xs font-bold border-blue-300 focus:ring-2 focus:ring-blue-500 h-9 bg-white text-blue-700" />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl text-xs sm:text-sm shadow-sm active:scale-[0.98] transition-all">ยืนยันและบันทึกข้อมูล</Button>
          </CardContent>
        </Card>
      </div>

      {/* ส่วนสรุปสถิติความก้าวหน้า (KPI Dashboards และ ตัวกรองวันที่) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        <Card className="border-l-4 border-l-amber-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้ไฟฟ้าประจำเดือน</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">{currentMonthStats.electric} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[10px] sm:text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600"><Zap className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้น้ำประปา (ร้านค้า)</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">{currentMonthStats.water} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[10px] sm:text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-0.5"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600"><Droplet className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-1 shadow-sm rounded-xl bg-white border border-slate-200/60 p-3 flex flex-col justify-center space-y-2">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> ค้นหาตามช่วงเวลาบันทึก</span>
          <div className="grid grid-cols-2 gap-2">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-xs bg-slate-50/50" />
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-xs bg-slate-50/50" />
          </div>
          {(startDate || endDate) && (
            <Button size="sm" variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); }} className="h-6 text-[11px] text-rose-500 hover:text-rose-600 p-0 self-end">ล้างตัวกรอง</Button>
          )}
        </Card>
      </div>

      {/* ส่วนแสดงตารางประวัติบันทึกข้อมูล */}
      <Card className="shadow-sm border border-slate-200/80 rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2">
            ประวัติการจดบันทึกย้อนหลัง
          </CardTitle>
          <span className="text-[11px] text-slate-500 bg-slate-200/60 px-2.5 py-0.5 rounded-full font-medium">
            ทั้งหมด {filteredLogs.length} รายการ
          </span>
        </CardHeader>
        <div className="overflow-x-auto w-full">
          <Table>
            <TableHeader className="bg-slate-50/70">
              <TableRow>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 whitespace-nowrap">วัน-เวลาที่บันทึก</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 whitespace-nowrap">สถานที่ติดตั้ง</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right whitespace-nowrap">เลขไฟงวดก่อน</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right whitespace-nowrap">เลขไฟล่าสุด</TableHead>
                <TableHead className="text-xs font-bold text-indigo-600 py-3 text-right whitespace-nowrap">ไฟฟ้าที่ใช้ (หน่วย)</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right whitespace-nowrap">เลขน้ำงวดก่อน</TableHead>
                <TableHead className="text-xs font-semibold text-slate-600 py-3 text-right whitespace-nowrap">เลขน้ำล่าสุด</TableHead>
                <TableHead className="text-xs font-bold text-blue-600 py-3 text-right whitespace-nowrap">น้ำที่ใช้ (หน่วย)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-xs text-slate-400">ไม่พบประวัติข้อมูลตามเงื่อนไข</TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log: any) => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="text-xs text-slate-600 py-2.5 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })}
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-slate-800 py-2.5 whitespace-nowrap">
                      {log.electricity_meters?.meter_name || 'ไม่ทราบสถานที่'}
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-500 py-2.5">{log.previous_value}</TableCell>
                    <TableCell className="text-xs text-right font-medium text-slate-700 py-2.5">{log.current_value}</TableCell>
                    <TableCell className="text-xs text-right font-bold text-indigo-600 bg-indigo-50/30 py-2.5">
                      {log.units_used?.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-right text-slate-500 py-2.5">{log.previous_water_value || '-'}</TableCell>
                    <TableCell className="text-xs text-right font-medium text-slate-700 py-2.5">{log.current_water_value || '-'}</TableCell>
                    <TableCell className="text-xs text-right font-bold text-blue-600 bg-blue-50/30 py-2.5">
                      {log.current_water_value && log.previous_water_value ? (log.current_water_value >= log.previous_water_value ? log.current_water_value - log.previous_water_value : (10000 - log.previous_water_value) + log.current_water_value).toLocaleString() : '-'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
