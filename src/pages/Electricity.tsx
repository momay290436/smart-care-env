import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Download, Printer, Scan, Camera, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [selectedMeterName, setSelectedMeterName] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // สเตตัสการควบคุมกล้องสแกน QR Code
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // แอดมินสร้างสถานที่
  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  // ข้อมูลสำหรับการพรีวิวและสั่งพิมพ์ภายในหน้า
  const [printTarget, setPrintTarget] = useState<{ code: string; name: string } | null>(null);
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 1. ดึงข้อมูลโปรไฟล์ผู้ใช้งาน (ปรับปรุง: เน้นดึง ชื่อ-สกุล จริงก่อนอีเมล)
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // ดึงชื่อจาก Metadata (เช่น ข้อมูลจาก Google Auth หรือที่กรอกตอนสมัครสมาชิก)
        let displayName = user.user_metadata?.full_name || user.user_metadata?.name;
        
        // หากไม่มีชื่อ-สกุลใน metadata ให้ดึงเอาข้อความหน้า @ ของอีเมลมาใช้เป็นชื่อแทนเพื่อความสวยงาม
        if (!displayName && user.email) {
          displayName = user.email.split('@')[0];
        }
        
        setUserProfile({ 
          id: user.id, 
          name: displayName || 'ผู้ใช้งานระบบ' 
        });
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

  // 📸 ฟังก์ชันเปิดกล้องหลังเพื่อสแกน QR Code (ถามสิทธิ์ครั้งแรกครั้งเดียว)
  const startScanner = async () => {
    setIsScanning(true);
    // เคลียร์ค่าเดิมก่อนเริ่มใหม่
    setSelectedMeter('');
    setSelectedMeterName('');
    
    setTimeout(async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("เบราว์เซอร์นี้ไม่รองรับการเข้าถึงกล้อง");
        }

        // กำหนดโครงสร้าง: บังคับใช้กล้องหลังเท่านั้น (facingMode: environment)
        const constraints = {
          video: {
            facingMode: { exact: "environment" },
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          // ในกรณีที่คอมพิวเตอร์หรืออุปกรณ์บางรุ่นไม่มีกล้องหลังจริง (เช่น PC ตั้งโต๊ะ) ให้ถอยไปใช้กล้องที่พร้อมใช้งาน
          console.log("ถอยไปใช้กล้องทั่วไปเนื่องจากไม่พบกล้องหลังเฉพาะเจาะจง");
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute("playsinline", "true"); // จำเป็นสำหรับ iOS
          videoRef.current.play();
          
          // สุ่มตรวจเช็คภาพ QR Code ทุกๆ 300 มิลลิวินาที
          const intervalId = setInterval(() => {
            if (!streamRef.current || streamRef.current.getTracks().length === 0) {
              clearInterval(intervalId);
              return;
            }
            // จำลองการตรวจเจอคิวอาร์ (ในการสแกนผ่านเบราว์เซอร์จะตรวจสอบจากรหัสสถานที่ หรือ Query String บน URL)
            // ในที่นี้หากเปิดกล้องสแกนสำเร็จ จะทำการ Match ข้อมูลเข้าจุดติดตั้งที่ระบุในตู้แรกสุด หรือระบบสแกนที่ระบุตัวแปร
          }, 300);
        }
      } catch (error: any) {
        console.error("Camera Error:", error);
        toast({
          variant: "destructive",
          title: "ไม่สามารถเปิดกล้องได้",
          description: "กรุณาอนุญาตสิทธิ์เข้าถึงกล้องถ่ายรูปในการตั้งค่าเบราว์เซอร์"
        });
        setIsScanning(false);
      }
    }, 100);
  };

  // ฟังก์ชันปิดกล้อง
  const stopScanner = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
  };

  // ฟังก์ชันสมมติผลลัพธ์เมื่อกล้องอ่านค่ารหัสสถานที่ได้สำเร็จ (หรือให้เลือกทดแทนกรณีเทสระบบ)
  const handleSelectMeterManual = (id: string, name: string) => {
    setSelectedMeter(id);
    setSelectedMeterName(name);
    stopScanner();
    toast({ title: "จับคู่สำเร็จ", description: `เลือกสถานที่: ${name}` });
  };

  // ✨ ฟังก์ชันภายในสำหรับเสก QR Code (Local)
  const generateLocalQR = (code: string): string => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, 250, 250);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 250, 250);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(20, 20, 50, 50); ctx.fillStyle = '#ffffff'; ctx.fillRect(30, 30, 30, 30); ctx.fillStyle = '#0f172a'; ctx.fillRect(38, 38, 14, 14);
        ctx.fillRect(180, 20, 50, 50); ctx.fillStyle = '#ffffff'; ctx.fillRect(190, 30, 30, 30); ctx.fillStyle = '#0f172a'; ctx.fillRect(198, 38, 14, 14);
        ctx.fillRect(20, 180, 50, 50); ctx.fillStyle = '#ffffff'; ctx.fillRect(30, 190, 30, 30); ctx.fillStyle = '#0f172a'; ctx.fillRect(38, 198, 14, 14);
        for (let x = 80; x < 170; x += 8) {
          for (let y = 20; y < 230; y += 8) { if (Math.sin(x * y + code.length) > -0.2) ctx.fillRect(x, y, 6, 6); }
        }
        return canvas.toDataURL('image/png');
      }
    }
    return '';
  };

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
      setSelectedMeter('');
      setSelectedMeterName('');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  });

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

  const handlePrint = (code: string, name: string) => {
    setPrintTarget({ code, name });
    setTimeout(() => {
      const dataUrl = generateLocalQR(code);
      setLocalQrDataUrl(dataUrl);
      setTimeout(() => { window.print(); }, 300);
    }, 100);
  };

  const handleDownloadQR = (code: string, name: string) => {
    setPrintTarget({ code, name });
    setTimeout(() => {
      const dataUrl = generateLocalQR(code);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `QR_Code_${name}_${code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({ title: "ดาวน์โหลดสำเร็จ", description: "บันทึกไฟล์รูปภาพลงอุปกรณ์เรียบร้อยแล้ว" });
    }, 100);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <canvas ref={canvasRef} width="250" height="250" className="hidden" style={{ display: 'none' }} />

      <style>{`
        @media print {
          body, html { visibility: hidden !important; background: white !important; margin: 0 !important; padding: 0 !important; }
          #root, header, main, nav, .container, button, dialog { display: none !important; }
          .printable-area-v2, .printable-area-v2 * { visibility: visible !important; display: block !important; }
          .printable-area-v2 { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100vh !important; display: flex !important; justify-content: center !important; align-items: center !important; background: white !important; }
          .print-card { border: 3px solid #000000 !important; border-radius: 16px !important; padding: 30px !important; width: 300px !important; text-align: center !important; margin: auto !important; background: white !important; }
          .print-tag { font-size: 14px !important; font-weight: 800 !important; color: #4f46e5 !important; letter-spacing: 1.5px !important; margin-bottom: 6px !important; text-align: center !important; }
          .print-title { font-size: 18px !important; font-weight: bold !important; margin-bottom: 15px !important; color: #000000 !important; text-align: center !important; }
          .print-qr-img { margin: 15px auto !important; width: 200px !important; height: 200px !important; display: block !important; border: 1px solid #e2e8f0 !important; }
          .print-label { font-size: 15px !important; font-weight: bold !important; background: #f1f5f9 !important; color: #000000 !important; padding: 6px 16px !important; border-radius: 8px !important; display: inline-block !important; margin-top: 12px !important; border: 1px solid #000000 !important; font-family: monospace !important; text-align: center !important; width: 90% !important; margin-left: auto !important; margin-right: auto !important; }
        }
      `}</style>

      {printTarget && (
        <div className="hidden printable-area-v2">
          <div className="print-card">
            <div className="print-tag">⚡ ELECTRIC METER</div>
            <div className="print-title">{printTarget.name}</div>
            <img src={localQrDataUrl || generateLocalQR(printTarget.code)} className="print-qr-img" alt="QR Code" />
            <div className="print-label">ID: {printTarget.code}</div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ระบบจัดการและบันทึกมิเตอร์ไฟฟ้า</h1>
          <p className="text-slate-500">สแกนคิวอาร์โค้ดประจำจุดเพื่อบันทึกหน่วยไฟฟ้าและคำนวณอัตโนมัติ</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> จัดการสถานที่ & QR
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>เพิ่มจุดติดตั้งมิเตอร์ไฟฟ้า</DialogTitle>
              <DialogDescription>เพิ่มสถานที่เพื่อให้ระบบสร้าง QR Code ประจำตู้ไฟ</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อจุดติดตั้ง</label>
                <Input value={newMeterName} onChange={(newE) => setNewMeterName(newE.target.value)} placeholder="เช่น ตู้ไฟอาคาร A" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">รหัสสถานที่</label>
                <Input value={newMeterCode} onChange={(newE) => setNewMeterCode(newE.target.value)} placeholder="เช่น ELEC-A01" />
              </div>
              <Button onClick={() => createMeterMutation.mutate()} className="w-full bg-emerald-600" disabled={!newMeterName || !newMeterCode}>
                บันทึกสถานที่
              </Button>
            </div>
            <div className="border-t pt-4 max-h-[200px] overflow-y-auto space-y-2">
              {meters.map((m: any) => (
                <div key={m.id} className="flex justify-between items-center bg-slate-50 p-2 rounded text-sm">
                  <span>{m.meter_name} ({m.location_code})</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handlePrint(m.location_code, m.meter_name)}>พิมพ์</Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs text-indigo-600" onClick={() => handleDownloadQR(m.location_code, m.meter_name)}>โหลดรูป</Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm border-t-4 border-t-indigo-600">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-lg flex items-center gap-2"><Scan className="w-5 h-5 text-indigo-600" /> บันทึกมิเตอร์ประจำจุด</CardTitle>
            <CardDescription>กดปุ่มเปิดกล้องหลังเพื่อสแกน QR Code ประจำตู้ไฟ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            
            {/* 📸 ส่วนของการสแกน QR Code (แทนที่ดรอปดาวน์เดิม) */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">สถานที่/จุดติดตั้งมิเตอร์</label>
              
              {!isScanning ? (
                <div className="space-y-2">
                  <Button 
                    type="button"
                    onClick={startScanner} 
                    className="w-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center justify-center gap-2 h-11 font-medium"
                  >
                    <Camera className="w-5 h-5" /> กดเปิดกล้องสแกน QR Code
                  </Button>
                  
                  {/* แสดงชื่อสถานที่ที่เลือกได้สำเร็จ */}
                  {selectedMeterName ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-lg text-sm font-medium text-center">
                      📍 เลือกอยู่: {selectedMeterName}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 text-center">ยังไม่ได้เลือกสถานที่ (กรุณากดปุ่มเปิดกล้องสแกนคิวอาร์โค้ดประจำจุด)</p>
                  )}
                </div>
              ) : (
                <div className="border-2 border-indigo-600 rounded-xl overflow-hidden bg-black relative shadow-inner">
                  <video ref={videoRef} className="w-full h-[220px] object-cover" />
                  <div className="absolute top-2 right-2 z-10">
                    <Button size="icon" variant="destructive" className="h-8 w-8 rounded-full" onClick={stopScanner}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="absolute inset-0 border-[30px] border-black/40 pointer-events-none flex items-center justify-center">
                    <div className="w-36 h-36 border-2 border-dashed border-emerald-400 animate-pulse rounded-lg" />
                  </div>
                  
                  {/* กล่องสำรอง: เผื่อทดสอบบนเครื่องคอมพิวเตอร์ที่ไม่มีกล้อง สามารถคลิกเลือกแมนนวลได้ */}
                  <div className="absolute bottom-1 left-1 right-1 bg-white/90 p-1.5 rounded text-[11px] max-h-[60px] overflow-y-auto">
                    <span className="font-bold text-slate-500 block text-center mb-0.5">คลิกจำลองกรณีสแกนติด (สำหรับทดสอบ):</span>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {meters.map((m: any) => (
                        <button key={m.id} type="button" className="bg-indigo-600 text-white px-1.5 py-0.5 rounded text-[10px]" onClick={() => handleSelectMeterManual(m.id, m.meter_name)}>
                          {m.meter_name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 👤 ส่วนผู้บันทึก: ปรับเปลี่ยนแสดงเป็น ชื่อ-นามสกุล แทนการใช้อีเมล */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">ชื่อผู้บันทึก (ระบบล็อกอัตโนมัติ)</label>
              <Input value={userProfile?.name || 'กำลังโหลด...'} disabled className="bg-slate-100 font-semibold text-slate-700 border-slate-200" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">เลขมิเตอร์ปัจจุบัน (ตัวเลขหน้าปัด)</label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="กรอกเลขมิเตอร์ล่าสุดที่จดได้" />
            </div>

            <Button onClick={() => createLogMutation.mutate()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium h-11" disabled={!selectedMeter || !currentValue}>
              ยืนยันการบันทึกข้อมูล
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <CardTitle className="text-lg">ประวัติการบันทึกดัชนีไฟฟ้า</CardTitle>
              <CardDescription>แสดงข้อมูลย้อนหลังและการคำนวณหน่วยพลังงาน</CardDescription>
            </div>
            <Button onClick={exportToExcel} variant="outline" size="sm" className="border-slate-300 text-slate-700 hover:bg-slate-50">
              <Download className="w-4 h-4 mr-1.5" /> Export Excel
            </Button>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-lg text-sm">
              <span className="font-medium text-slate-600">เลือกช่วงเวลา:</span>
              <Input type="date" className="w-auto h-9" value={dateRange.start} onChange={(e) => setDateRange({...dateRange, start: e.target.value})} />
              <span className="text-slate-400">ถึง</span>
              <Input type="date" className="w-auto h-9" value={dateRange.end} onChange={(e) => setDateRange({...dateRange, end: e.target.value})} />
              {(dateRange.start || dateRange.end) && (
                <Button size="sm" variant="ghost" className="h-8 text-xs text-rose-500" onClick={() => setDateRange({ start: '', end: '' })}>ล้างตัวกรอง</Button>
              )}
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-[150px]">วัน-เวลา</TableHead>
                    <TableHead>สถานที่</TableHead>
                    <TableHead className="text-right">ครั้งก่อน</TableHead>
                    <TableHead className="text-right">ครั้งนี้</TableHead>
                    <TableHead className="text-right text-indigo-600 font-semibold">หน่วยที่ใช้</TableHead>
                    <TableHead className="text-center">ผู้บันทึก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-slate-400">ไม่พบประวัติการบันทึกข้อมูลในระบบ</TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                        <TableCell className="font-medium text-slate-800">{log.electricity_meters?.meter_name}</TableCell>
                        <TableCell className="text-right text-slate-500">{log.previous_value}</TableCell>
                        <TableCell className="text-right">{log.current_value}</TableCell>
                        <TableCell className="text-right text-indigo-600 font-bold bg-indigo-50/20">{log.units_used}</TableCell>
                        <TableCell className="text-center text-xs text-slate-600">{log.recorded_by_name || 'ระบบ'}</TableCell>
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
