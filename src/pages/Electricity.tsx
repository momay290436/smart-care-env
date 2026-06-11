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

  // 2. คำนวณยอด KPI สรุปของเดือนปัจจุบัน (ตามเวลาจริงในระบบปัจจุบัน ณ ปี 2026)
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-11

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      const logDate = new Date(log.created_at);
      if (logDate.getFullYear() === currentYear && logDate.getMonth() === currentMonth) {
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
        { fps: 10, qrbox: 250 }, 
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

  // จัดเก็บข้อมูลลงฐานข้อมูล (คำนวณส่วนต่างหน่วยให้เรียบร้อย)
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

      const insertData: any = {
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        units_used: currentVal - prevVal // ระบบนำยอดที่บันทึกล่าสุดลบยอดครั้งก่อนให้โดยอัตโนมัติ
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

  // ฟังก์ชัน Export แยกหน้าแผ่นงาน (Tabs) ตามรูปแบบคำในวงเล็บ (รวมทั้งที่กรองหน้าจอด้วย)
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

    // ดึงเฉพาะข้อมูลที่ผ่าน Filter ของหน้าจอไปพิมพ์ออก Excel ให้ตรงตามหน้างาน
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
    // ✨ ปรับ Layout ให้กางขนาดเต็มหน้าจอแบบ 100vw สำหรับเครื่อง PC
    <div className="w-full max-w-[100vw] px-4 sm:px-8 py-6 space-y-6 bg-slate-50/50 min-h-screen">
      
      {/* ส่วนหัวของระบบหน้าเว็บ */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">ระบบบริหารจัดการมิเตอร์สาธารณูปโภค</h1>
          <p className="text-xs text-slate-500 mt-1">บันทึก ติดตาม และคัดแยกรายงานสถิติการใช้งานระบบไฟฟ้าและน้ำประปา</p>
        </div>
        <div className="grid grid-cols-2 md:flex gap-2.5">
          <Button onClick={exportExcel} variant="outline" className="text-xs sm:text-sm h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-medium">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600"/> Export แยกหมวดหมู่
          </Button>
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:'', qr_url:''}); } }}>
            <DialogTrigger asChild>
              <Button className="text-xs sm:text-sm h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm">
                <Plus className="mr-2 h-4 w-4" /> เพิ่มสถานที่ติดตั้ง
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] sm:max-w-[425px] rounded-2xl">
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งและทำ QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
                    <div>
                      <label className="text-xs text-slate-500 font-medium mb-1 block">ชื่อสถานที่ (กรุณาใส่วงเล็บ เช่น ร้านค้าสมาน(ร้านค้า), ห้อง101(แฟลต1))</label>
                      <Input placeholder="เช่น สมชาย(ร้านค้า) หรือ อาคารA(แฟลต1)" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์</label>
                      <Input placeholder="กรอกรหัสเลขเครื่อง" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 font-medium mb-1 block">รหัสภายใน (ถ้ามี)</label>
                      <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                    </div>
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2 h-11" onClick={handleSaveMeter}>บันทึกและสร้างคิวอาร์</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                    <span className="text-sm font-semibold text-emerald-600">ระบบสร้างคิวอาร์สำเร็จ</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-48 h-48 object-contain" />
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center h-11" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดคิวอาร์ (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ✨ ส่วนแสดง KPI Dashboards ประจำเดือนปัจจุบันขยายกว้างเต็มตา */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card className="border-l-4 border-l-amber-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้ไฟฟ้าประจำเดือน</p>
              <h3 className="text-2xl font-black text-slate-800">{currentMonthStats.electric} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-3.5 bg-amber-50 rounded-xl text-amber-600"><Zap className="h-6 w-6" /></div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้น้ำประปาประจำเดือน (เฉพาะร้านค้า)</p>
              <h3 className="text-2xl font-black text-slate-800">{currentMonthStats.water} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-1"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-3.5 bg-blue-50 rounded-xl text-blue-600"><Droplet className="h-6 w-6" /></div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm rounded-xl bg-white border border-slate-100 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1 w-full">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">ตัวกรองเลือกช่วงวันที่เรียกดู</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400 uppercase">จาก</span>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-9 pr-1 text-xs h-9 font-medium text-slate-700 bg-slate-50 border-slate-200" />
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-2.5 text-[10px] font-bold text-slate-400 uppercase">ถึง</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-9 pr-1 text-xs h-9 font-medium text-slate-700 bg-slate-50 border-slate-200" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* เนื้อหาหลักแบ่งโครงสร้างเป็น 2 ฝั่งเมื่อแสดงในคอมพิวเตอร์ (บันทึกข้อมูลด้านซ้าย ตารางประวัติยาวๆ ด้านขวา) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        
        {/* คาร์ดสำหรับกดบันทึกข้อมูล (ซ้ายสุด) */}
        <Card className="lg:col-span-1 shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4">
            <CardTitle className="text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-500"/>ลงบันทึกค่างวดมิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 px-4 pb-5">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-xl text-sm font-semibold shadow-sm transition-all">
                <Camera className="mr-2 h-4 w-4"/> เปิดกล้องสแกนคิวอาร์
              </Button>
            ) : (
              <div className="relative h-[240px] border-4 border-indigo-500 rounded-xl overflow-hidden shadow-inner bg-black">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2 rounded-full h-8 w-8 p-0" size="sm" variant="destructive"><X className="h-4 w-4"/></Button>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-500">สถานที่ปฏิบัติงานที่ตรวจจับได้</label>
              <Input value={meterDisplayName} placeholder="ชื่อสถานที่สแกนจะแสดงตรงนี้" readOnly className="bg-slate-50 text-center font-bold text-slate-800 border-slate-200 text-sm h-10" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-600 flex items-center gap-1"><Zap className="h-3 w-3"/> เลขมิเตอร์ไฟฟ้าปัจจุบัน</label>
              <Input type="number" value={currentValue} placeholder="ระบุตัวเลขไฟฟ้าล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-lg Harman font-bold border-slate-300 focus:ring-2 focus:ring-indigo-500 h-11" />
            </div>

            {/* ส่วนมิเตอร์น้ำเพิ่มเติมสำหรับร้านค้า */}
            {isShop && (
              <div className="space-y-1 p-3 bg-blue-50/70 border border-blue-100 rounded-xl animate-in fade-in duration-200">
                <label className="text-xs font-bold text-blue-600 flex items-center gap-1"><Droplet className="h-3 w-3"/> เลขมิเตอร์น้ำปัจจุบัน (เฉพาะร้านค้า)</label>
                <Input type="number" value={currentWaterValue} placeholder="กรอกเลขหน้าปัดมิเตอร์น้ำ" onChange={(e) => setCurrentWaterValue(e.target.value)} className="text-center text-base font-bold border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 text-blue-700 h-10" />
              </div>
            )}

            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-5 rounded-xl shadow-sm transition-all">ยืนยันและบันทึกข้อมูล</Button>
          </CardContent>
        </Card>

        {/* ✨ คาร์ดตารางประวัติข้อมูลขนาดกว้างเต็มหน้าจอ PC (ขวาสุด) */}
        <Card className="lg:col-span-3 shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-700">ประวัติจัดเก็บข้อมูลในระบบ ({filteredLogs.length} รายการ)</CardTitle>
            {(startDate || endDate) && (
              <Button size="sm" variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); }} className="text-xs text-rose-600 hover:bg-rose-50 h-7 px-2">ล้างตัวกรองวันที่</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    {/* ตั้งชื่อหัวข้อคอลัมน์และปรับความกว้างขั้นต่ำ (min-width) ให้เหมาะสมกับข้อมูลแต่ละประเภท */}
                    <TableHead className="text-slate-600 font-bold text-xs py-3.5 pl-5 min-w-[150px]">วัน/เดือนปี</TableHead>
                    <TableHead className="text-slate-600 font-bold text-xs py-3.5 min-w-[180px]">จุดมิเตอร์</TableHead>
                    <TableHead className="text-slate-600 font-bold text-xs py-3.5 text-right min-w-[130px]">เลขมิเตอร์ไฟฟ้า</TableHead>
                    <TableHead className="text-slate-600 font-bold text-xs py-3.5 text-right min-w-[130px]">เลขมิเตอร์น้ำ</TableHead>
                    <TableHead className="text-slate-600 font-bold text-xs py-3.5 text-right pr-5 min-w-[160px]">ใช้ไฟรวม (หน่วย)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-400 py-12 text-xs font-medium">ไม่พบข้อมูลประวัติในช่วงเวลาที่ระบุ</TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log: any) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/70">
                        <TableCell className="text-slate-500 font-medium text-xs pl-5 py-3.5">{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                        <TableCell className="font-bold text-slate-700 text-xs py-3.5">{log.electricity_meters?.meter_name || 'ไม่ระบุจุดติดตั้ง'}</TableCell>
                        <TableCell className="text-right text-slate-600 font-semibold text-xs py-3.5">{log.current_value.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-blue-600 font-bold text-xs py-3.5">
                          {log.current_water_value ? log.current_water_value.toLocaleString() : '-'}
                        </TableCell>
                        {/* คำนวณส่วนต่างหน่วยที่นำยอดบันทึกล่าสุดลบยอดครั้งก่อนหน้า */}
                        <TableCell className="text-right pr-5 py-3.5">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 bg-emerald-50 text-emerald-700 font-black text-xs rounded-lg border border-emerald-100">
                            +{log.units_used ?? 0} หน่วย
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
