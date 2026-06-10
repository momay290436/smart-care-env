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
  const [selectedMeterId, setSelectedMeterId] = useState(''); // เก็บ ID จริงของมิเตอร์เพื่อบันทึกลงฐานข้อมูล
  const [meterDisplayName, setMeterDisplayName] = useState(''); // เก็บชื่อสถานที่จริงเพื่อแสดงผลบนหน้าจอ
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับการเพิ่มจุดติดตั้งและรับรูป QR Code
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });
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

  // ฟังก์ชันบันทึกข้อมูลมิเตอร์และคำนวณส่วนต่างอัตโนมัติ
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกน QR สถานที่ และระบุเลขมิเตอร์ปัจจุบัน" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);

      // 1. ค้นหาประวัติบันทึกล่าสุดของมิเตอร์ตัวนี้เพื่อดึงเลขครั้งก่อนหน้ามาคำนวณลบกัน
      const { data: lastLog, error: fetchError } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const prevVal = lastLog?.current_value || 0;
      
      // 2. คำนวณจำนวนหน่วยไฟฟ้าที่ใช้ไปโดยอัตโนมัติ
      const unitsUsed = currentVal - prevVal;

      if (unitsUsed < 0) {
        toast({ variant: "destructive", title: "ข้อมูลไม่ถูกต้อง", description: "เลขมิเตอร์ปัจจุบันค่าน้อยกว่าเลขมิเตอร์ครั้งก่อนหน้า" });
        return;
      }

      // 3. บันทึกข้อมูลลงใน Table electricity_logs ตามโครงสร้างในระบบจริงของคุณ
      const { error: insertError } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        units_used: unitsUsed
      }]);

      if (insertError) throw insertError;
      
      toast({ title: "บันทึกประวัติสำเร็จ", description: `คำนวณการใช้ไฟฟ้าสุทธิ: ${unitsUsed} หน่วย` });
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
      
      setNewMeter({ name: '', code: '', serial: '' });
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
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">ระบบบันทึกไฟฟ้า</h1>
        <div className="grid grid-cols-2 sm:flex gap-2">
          <Button onClick={exportExcel} variant="outline" className="text-xs sm:text-sm"><FileSpreadsheet className="mr-2 h-4 w-4"/> Export</Button>
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:''}); } }}>
            <DialogTrigger asChild>
              <Button className="text-xs sm:text-sm"><Plus className="mr-2 h-4 w-4" /> เพิ่มสถานที่</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] sm:max-w-[425px] rounded-xl">
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งและทำ QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">ชื่อสถานที่</label>
                      <Input placeholder="เช่น ร้านค้าสมาน" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์ (เช่น 001)</label>
                      <Input placeholder="กรอกเฉพาะตัวเลขหรือรหัสเครื่อง" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 font-medium mb-1 block">รหัสภายใน (ถ้ามี)</label>
                      <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                    </div>
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2" onClick={handleSaveMeter}>บันทึกสถานที่และเจนคิวอาร์</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                    <span className="text-sm font-semibold text-emerald-600">สำเร็จ! ระบบสร้างคิวอาร์เรียบร้อย</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-48 h-48 object-contain" />
                    </div>
                    <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">{newMeter.serial.toLowerCase()}.lovable.com</span>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดภาพ QR Code (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* คอนโทรลส่วนบันทึกข้อมูล */}
        <Card className="lg:col-span-1 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3">
            <CardTitle className="text-sm sm:text-base text-gray-700">จดบันทึกค่าพลังงาน</CardTitle>
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
              <Input value={meterDisplayName} placeholder="ชื่อสถานที่จริงจะปรากฏที่นี่" readOnly className="bg-gray-100 text-center font-bold text-gray-800 border-gray-200 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">ตัวเลขหน้าปัดมิเตอร์ไฟฟ้าปัจจุบัน</label>
              <Input type="number" value={currentValue} placeholder="ระบุตัวเลขปัจจุบันล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-lg font-bold border-gray-300 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-sm">ยืนยันและบันทึก</Button>
          </CardContent>
        </Card>

        {/* ส่วนแสดงประวัติ */}
        <Card className="lg:col-span-2 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3">
            <CardTitle className="text-sm sm:text-base text-gray-700">ประวัติจัดเก็บข้อมูล</CardTitle>
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
                        <TableCell className="font-bold text-gray-700">{log.electricity_meters?.meter_name || 'ไม่พบชื่อสถานที่'}</TableCell>
                        <TableCell className="text-right text-gray-500 text-xs">ครั้งก่อน: {log.previous_value ?? 0}</TableCell>
                        <TableCell className="text-right text-gray-700 font-medium">ปัจจุบัน: {log.current_value}</TableCell>
                        <TableCell className="text-right text-emerald-600 font-bold bg-emerald-50/40 rounded-md">ใช้ไป: +{log.units_used ?? 0} หน่วย</TableCell>
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
