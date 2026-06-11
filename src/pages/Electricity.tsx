import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Droplet, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับเก็บข้อมูลมิเตอร์ไฟและน้ำ
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); // เพิ่ม State ค่าน้ำ
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับสร้างจุดติดตั้งและคิวอาร์โค้ด
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตรวจสอบว่าเป็นประเภทร้านค้าหรือไม่ เพื่อเปิดช่องกรอกเลขมิเตอร์น้ำ
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติการบันทึกพร้อมดึงโครงสร้างชื่อสถานที่มาใช้งานร่วมกัน
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
          created_at,
          electricity_meters (
            meter_name
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

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

  // จัดเก็บข้อมูลลง Supabase (รองรับทั้งไฟและน้ำ)
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

      // ค้นหาประวัติบันทึกล่าสุดเพื่อดึงค่าเดิมมาคำนวณส่วนต่างหน่วยที่ใช้
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
        units_used: currentVal - prevVal
      };

      // บันทึกน้ำเพิ่มเติมหากเป็นร้านค้า
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

  // ✨ ฟังก์ชัน Export แยกหน้าแผ่นงาน (Tabs) ตามรูปแบบคำในวงเล็บ
  const exportExcel = () => {
    // 1. ฟอร์แมตข้อมูลรูปแบบกลางเพื่อใช้ในแผ่นงาน "รวมทุกสถานที่"
    const formatLogItem = (log: any) => ({
      'วัน-เวลาที่จด': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูล',
      'เลขมิเตอร์ไฟครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ไฟล่าสุด': log.current_value,
      'จำนวนหน่วยไฟที่ใช้ประจำงวด': log.units_used,
      'เลขมิเตอร์น้ำปัจจุบัน (ถ้ามี)': log.current_water_value || '-'
    });

    const allRecords = logs.map(formatLogItem);

    // กำหนดประเภทแท็บชีตตามเงื่อนไขวงเล็บท้ายชื่อสถานที่
    const categories = [
      { key: 'ร้านค้า', label: 'ร้านค้า' },
      { key: 'บ้านพัก', label: 'บ้านพัก' },
      { key: 'แฟลต1', label: 'แฟลต1' },
      { key: 'แฟลต2', label: 'แฟลต2' },
      { key: 'แฟลต3', label: 'แฟลต3' },
      { key: 'แฟลต4', label: 'แฟลต4' }
    ];

    // สร้าง Workbook กลางของ Excel
    const wb = XLSX.utils.book_new();

    // แผ่นงานแท็บที่ 1: รวมทุกสถานที่
    const wsAll = XLSX.utils.json_to_sheet(allRecords);
    XLSX.utils.book_append_sheet(wb, wsAll, "รวมทุกสถานที่");

    // แผ่นงานแท็บย่อยๆ: คัดกรองแยกเฉพาะกลุ่มตามวงเล็บท้ายชื่อสถานที่
    categories.forEach(category => {
      const filteredLogs = logs.filter((log: any) => {
        const name = log.electricity_meters?.meter_name || '';
        return name.includes(`(${category.key})`);
      });

      // นำข้อมูลกลุ่มที่คัดกรองแปลงเป็นตาราง Row
      const filteredRecords = filteredLogs.map(formatLogItem);
      const wsFiltered = XLSX.utils.json_to_sheet(filteredRecords);
      
      // บันทึกลงในหน้าแผ่นงานแต่ละประเภท
      XLSX.utils.book_append_sheet(wb, wsFiltered, category.label);
    });

    // ดำเนินการดาวน์โหลดออกมาเป็นไฟล์ Excel สู่เครื่องผู้ใช้
    XLSX.writeFile(wb, "Meter_Report_Separated.xlsx");
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ระบบบันทึกไฟฟ้า & มิเตอร์น้ำ</h1>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button onClick={exportExcel} variant="outline" className="text-xs sm:text-sm"><FileSpreadsheet className="mr-2 h-4 w-4"/> Export แยกหมวดหมู่</Button>
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:'', qr_url:''}); } }}>
            <DialogTrigger asChild>
              <Button className="text-xs sm:text-sm"><Plus className="mr-2 h-4 w-4" /> เพิ่มสถานที่</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] sm:max-w-[425px] rounded-xl">
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งและทำ QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">ชื่อสถานที่ (กรุณาใส่วงเล็บ เช่น ร้านค้าสมาน(ร้านค้า), บ้านพัด(บ้านพัก))</label>
                      <Input placeholder="เช่น สมชาย(ร้านค้า) หรือ อาคารA(แฟลต1)" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์</label>
                      <Input placeholder="กรอกรหัสเลขเครื่อง" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">รหัสภายใน (ถ้ามี)</label>
                      <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                    </div>
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2" onClick={handleSaveMeter}>บันทึกและสร้างคิวอาร์</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                    <span className="text-sm font-semibold text-emerald-600">ระบบสร้างคิวอาร์สำเร็จ</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-48 h-48 object-contain" />
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดคิวอาร์ (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3">
            <CardTitle className="text-sm sm:text-base text-gray-700">จดบันทึกค่ามิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-lg text-sm font-semibold shadow-md"><Camera className="mr-2 h-5 w-5"/> สแกนรหัสผ่านกล้อง</Button>
            ) : (
              <div className="relative h-[260px] border-4 border-indigo-500 rounded-xl overflow-hidden shadow-inner bg-black">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2 rounded-full h-8 w-8 p-0" size="sm" variant="destructive"><X className="h-4 w-4"/></Button>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">สถานที่ปฏิบัติงาน</label>
              <Input value={meterDisplayName} placeholder="ชื่อสถานที่สแกนจะแสดงตรงนี้" readOnly className="bg-gray-100 text-center font-bold text-gray-800 border-gray-200 text-sm" />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-600 flex items-center gap-1"><Zap className="h-3 w-3"/> เลขมิเตอร์ไฟฟ้าปัจจุบัน</label>
              <Input type="number" value={currentValue} placeholder="ระบุตัวเลขไฟฟ้าล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-lg font-bold border-gray-300 focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* ส่วนมิเตอร์น้ำเพิ่มเติมสำหรับร้านค้า */}
            {isShop && (
              <div className="space-y-1 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <label className="text-xs font-bold text-blue-600 flex items-center gap-1"><Droplet className="h-3 w-3"/> เลขมิเตอร์น้ำปัจจุบัน (เฉพาะกลุ่มร้านค้า)</label>
                <Input type="number" value={currentWaterValue} placeholder="กรอกเลขหน้าปัดมิเตอร์น้ำ" onChange={(e) => setCurrentWaterValue(e.target.value)} className="text-center text-base font-bold border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 text-blue-700" />
              </div>
            )}

            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-sm">ยืนยันและบันทึกข้อมูล</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3">
            <CardTitle className="text-sm sm:text-base text-gray-700">ประวัติบันทึกในระบบ</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            <div className="overflow-x-auto">
              <Table>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow><TableCell className="text-center text-gray-400 py-8 text-xs">ยังไม่มีข้อมูลรายการบันทึกในตาราง</TableCell></TableRow>
                  ) : (
                    logs.map((log: any) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                        <TableCell className="font-bold text-gray-700">{log.electricity_meters?.meter_name || 'ไม่พบจุดติดตั้ง'}</TableCell>
                        <TableCell className="text-right text-gray-700 font-medium">ไฟ: {log.current_value}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-bold bg-emerald-50/40 rounded-md">ใช้ไป: +{log.units_used ?? 0} หน่วย</TableCell>
                        <TableCell className="text-right text-blue-600 font-bold">
                          {log.current_water_value ? `น้ำ: ${log.current_water_value}` : '-'}
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
