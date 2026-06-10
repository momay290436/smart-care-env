import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Calendar, MapPin, Zap, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับระบบบันทึกค่า
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [meterDisplayName, setMeterDisplayName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับสร้างจุดติดตั้งและ QR Code
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติการบันทึกข้อมูล
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => {
      const { data } = await supabase.from('electricity_logs').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  // ฟังก์ชันสแกนคิวอาร์โค้ด และดึงชื่อสถานที่มาแสดงแทน URL
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

          const rawText = decodedText.trim().toLowerCase();
          // แปลงค่ากรณีสแกนได้ลิงก์ "001.lovable.com" ให้ดึงเฉพาะ "001" ออกมาค้นหา
          const extractedSerial = rawText.split('.')[0];

          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`serial_number.eq."${extractedSerial}",serial_number.eq."${rawText}",qr_url.eq."${rawText}"`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error(error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" });
            return;
          }

          if (meterData) {
            setSelectedMeterId(meterData.id);
            setMeterDisplayName(`${meterData.meter_name} (S/N: ${meterData.serial_number})`);
            toast({ title: "พบข้อมูลสถานที่", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('ไม่พบข้อมูลสถานที่นี้ในระบบ');
            toast({ variant: "destructive", title: "ไม่พบข้อมูล", description: `รหัสนี้ยังไม่ได้ผูกในระบบ: ${decodedText}` });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // บันทึกตัวเลขมิเตอร์ไฟฟ้าลง Log
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสสถานที่และระบุเลขมิเตอร์ก่อนบันทึก" });
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
      
      toast({ title: "บันทึกข้อมูลสำเร็จเรียบร้อย" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: err.message });
    }
  };

  // เพิ่มสถานที่ใหม่ และเจนลิงก์สำหรับเอาไปสร้างรูป QR Code ทันที
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

      // สร้าง URL สำหรับดึงรูปภาพ QR Code จาก API ฟรีเพื่อให้ผู้ใช้ดาวน์โหลดได้ทันที
      const qrCodeImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(autoQrUrl)}`;
      setGeneratedQrUrl(qrCodeImgApi);

      toast({ title: "เพิ่มสถานที่ใหม่สำเร็จ", description: `ระบบสร้าง QR Code ให้แล้ว สามารถกดดาวน์โหลดได้ด้านล่าง` });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
    }
  };

  // ฟังก์ชันสำหรับกดดาวน์โหลดรูปภาพ QR Code ออกมาเป็นไฟล์ .png
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
      
      // รีเซ็ตฟอร์มหลังจากดาวน์โหลดเสร็จสิ้น
      setNewMeter({ name: '', code: '', serial: '' });
      setGeneratedQrUrl('');
    } catch (error) {
      toast({ variant: "destructive", title: "ดาวน์โหลดล้มเหลว", description: "ไม่สามารถบันทึกไฟล์ภาพได้ กรุณาลองใหม่อีกครั้ง" });
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
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:''}); } }}>
            <DialogTrigger asChild><Button className="w-full text-xs sm:text-sm"><Plus className="mr-1 sm:mr-2 h-4 w-4" /> เพิ่มสถานที่</Button></DialogTrigger>
            <DialogContent className="max-w-[90vw] sm:max-w-[425px] rounded-xl">
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งและสร้าง QR</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
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
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2" onClick={handleSaveMeter}>บันทึกและสร้าง QR Code</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-4 space-y-4 text-center">
                    <span className="text-sm font-semibold text-emerald-600">สร้างสถานที่และ QR Code สำเร็จ!</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-48 h-48 object-contain" />
                    </div>
                    <span className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded">{newMeter.serial.toLowerCase()}.lovable.com</span>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดรูป QR Code (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* แผงควบคุมการสแกน */}
        <Card className="lg:col-span-1 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3 sm:py-4">
            <CardTitle className="text-sm sm:text-base text-gray-700">บันทึกข้อมูลมิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 sm:py-6 rounded-lg text-sm sm:text-base font-semibold shadow-md shadow-indigo-100"><Camera className="mr-2 h-5 w-5"/> เปิดกล้องสแกน QR</Button>
            ) : (
              <div className="relative h-[260px] sm:h-[300px] border-4 border-indigo-500 rounded-xl overflow-hidden shadow-inner bg-black">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2 rounded-full h-8 w-8 p-0" size="sm" variant="destructive"><X className="h-4 w-4"/></Button>
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">สถานที่ปฏิบัติงาน</label>
              <Input value={meterDisplayName} placeholder="ชื่อสถานที่หลังจากสแกน" readOnly className="bg-gray-50 text-center font-bold text-gray-700 border-gray-200 text-sm" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-500">ตัวเลขหน้าปัดปัจจุบัน</label>
              <Input type="number" value={currentValue} placeholder="กรอกเลขมิเตอร์ล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-lg font-bold border-gray-300 focus:ring-2 focus:ring-indigo-500" />
            </div>
            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-lg shadow-sm">บันทึกหน่วยพลังงาน</Button>
          </CardContent>
        </Card>

        {/* ประวัติรายการ (Mobile + Desktop Responsive) */}
        <Card className="lg:col-span-2 shadow-sm border border-gray-100 rounded-xl overflow-hidden">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100 py-3 sm:py-4">
            <CardTitle className="text-sm sm:text-base text-gray-700">ประวัติการบันทึกรายการล่าสุด</CardTitle>
          </CardHeader>
          <CardContent className="p-2 sm:p-4">
            {/* Mobile View: หน้าจอมือถือจะเรียงตัวเป็นการ์ดอย่างเป็นระเบียบ */}
            <div className="block sm:hidden space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {logs.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs">ยังไม่มีข้อมูลการจดบันทึกในระบบ</div>
              ) : (
                logs.map((log: any) => (
                  <div key={log.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm space-y-1.5 text-xs">
                    <div className="flex justify-between items-center border-b border-gray-50 pb-1.5">
                      <div className="flex items-center text-gray-700 font-bold"><MapPin className="h-3 w-3 mr-1 text-indigo-500"/>{log.meter_name || 'ไม่ทราบสถานที่'}</div>
                      <div className="text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center"><Zap className="h-2.5 w-2.5 mr-0.5"/>+{log.units_used ?? 0} หน่วย</div>
                    </div>
                    <div className="flex justify-between text-gray-500 pt-0.5">
                      <span className="flex items-center"><Calendar className="h-3 w-3 mr-1 text-gray-400"/> {new Date(log.created_at).toLocaleString('th-TH', {dateStyle: 'short', timeStyle: 'short'})}</span>
                      <span>เลขมิเตอร์: <strong className="text-gray-700 font-semibold">{log.current_value}</strong></span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop View: หน้าจอคอมพิวเตอร์จะแสดงผลแบบตารางแถวปกติ */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableBody>
                  {logs.map((log: any) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50">
                      <TableCell className="text-gray-500 text-xs">{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                      <TableCell className="font-bold text-gray-700">{log.meter_name || 'ไม่ทราบสถานที่'}</TableCell>
                      <TableCell className="text-right text-gray-600 font-medium">เลขมิเตอร์: {log.current_value}</TableCell>
                      <TableCell className="text-right text-emerald-600 font-bold bg-emerald-50/30">ใช้ไป: {log.units_used ?? 0} หน่วย</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
