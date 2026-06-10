import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Download, Printer, Scan } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // แอดมินสร้างสถานที่
  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  // ข้อมูลสำหรับเปิดใบพิมพ์และการดาวน์โหลดในหน้านี้
  const [printTarget, setPrintTarget] = useState<{ code: string; name: string } | null>(null);

  // 1. ดึงข้อมูลผู้ใช้งานปัจจุบันที่ล็อกอิน
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fullName = user.user_metadata?.full_name || user.email || 'ผู้ใช้งานระบบ';
        setUserProfile({ id: user.id, name: fullName });
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

  // ดึงลิงก์รูปภาพ QR Code (ใช้ของ Google Charts ปลอดภัย สูงสุด)
  const getQrUrl = (code: string) => {
    const targetUrl = `${window.location.origin}/electricity?code=${encodeURIComponent(code)}`;
    return `https://chart.googleapis.com/chart?chs=300x300&cht=qr&chl=${encodeURIComponent(targetUrl)}&choe=UTF-8`;
  };

  // ฟังก์ชันกดพิมพ์ป้ายมิเตอร์
  const handlePrint = (code: string, name: string) => {
    setPrintTarget({ code, name });
    // รอให้รูปโหลดเสร็จชัวร์ ๆ 800ms ป้องกันหน้ากระดาษพัง
    setTimeout(() => {
      window.print();
    }, 800);
  };

  // ✨ ฟังก์ชันสำหรับดาวน์โหลดภาพ QR Code ตรงเข้าเครื่องคอมพิวเตอร์/มือถือ
  const handleDownloadQR = async (code: string, name: string) => {
    try {
      const response = await fetch(getQrUrl(code));
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `QRCode-${name}-${code}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast({ title: "ดาวน์โหลดสำเร็จ", description: "บันทึกไฟล์ภาพคิวอาร์โค้ดลงในเครื่องแล้ว" });
    } catch (err) {
      toast({ variant: "destructive", title: "ไม่สามารถดาวน์โหลดได้", description: "กรุณาใช้ฟังก์ชันสั่งพิมพ์หรือแคปหน้าจอแทน" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 🖨️ สไตล์กำหนดการพิมพ์แบบเด็ดขาด: ล้างหน้าเว็บเดิมออก และบังคับให้การ์ดอยู่ตรงกลางกึ่งกลาง */}
      <style>{`
        @media print {
          body, html { background: #ffffff !important; margin: 0 !important; padding: 0 !important; width: 100% !important; height: 100% !important; }
          #root, header, main, nav, div:not(.printable-area), section, button { display: none !important; visibility: hidden !important; }
          .printable-area, .printable-area * { display: block !important; visibility: visible !important; }
          .printable-area { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; height: 100% !important; display: flex !important; justify-content: center !important; align-items: center !important; background: white !important; }
          .print-card { border: 3px solid #64748b !important; border-radius: 24px !important; padding: 32px !important; width: 320px !important; text-align: center !important; background: white !important; box-shadow: none !important; margin: auto !important; }
          .print-tag { font-size: 15px !important; font-weight: 800 !important; color: #4f46e5 !important; letter-spacing: 1.5px !important; margin-bottom: 8px !important; text-align: center !important; }
          .print-title { font-size: 20px !important; font-weight: bold !important; margin-bottom: 20px !important; color: #0f172a !important; text-align: center !important; }
          .print-qr-img { margin: 15px auto !important; width: 220px !important; height: 220px !important; display: block !important; }
          .print-label { font-size: 16px !important; font-weight: bold !important; background: #f1f5f9 !important; color: #1e293b !important; padding: 6px 20px !important; border-radius: 8px !important; display: inline-block !important; margin-top: 16px !important; border: 1px solid #cbd5e1 !important; font-family: monospace !important; text-align: center !important; width: 80% !important; margin-left: auto !important; margin-right: auto !important; }
        }
      `}</style>

      {/* บล็อกสำหรับส่งไปที่เครื่องพิมพ์เท่านั้น */}
      {printTarget && (
        <div className="hidden printable-area">
          <div className="print-card">
            <div className="print-tag">⚡ ELECTRIC METER</div>
            <div className="print-title">{printTarget.name}</div>
            <img src={getQrUrl(printTarget.code)} className="print-qr-img" alt="QR Code" />
            <div className="print-label">ID: {printTarget.code}</div>
          </div>
        </div>
      )}

      {/* หน้าจอส่วนแสดงผลปกติบนระบบ */}
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
                <Input value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} placeholder="เช่น ตู้ไฟอาคาร A, บ่อบำบัดน้ำเสีย" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">รหัสสถานที่ (สำหรับคิวอาร์โค้ด)</label>
                <Input value={newMeterCode} onChange={(e) => setNewMeterCode(e.target.value)} placeholder="เช่น ELEC-A01" />
              </div>
              <Button onClick={() => createMeterMutation.mutate()} className="w-full bg-emerald-600" disabled={!newMeterName || !newMeterCode}>
                บันทึกสถานที่
              </Button>
            </div>
            <div className="border-t pt-4 max-h-[250px] overflow-y-auto space-y-2">
              <p className="text-xs font-semibold text-slate-500">รายชื่อจุดที่เปิดใช้งานแล้ว (พิมพ์หรือดาวน์โหลด):</p>
              {meters.map((m: any) => (
                <div key={m.id} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-2.5 rounded text-sm gap-2">
                  <span className="font-medium">{m.meter_name} ({m.location_code})</span>
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handlePrint(m.location_code, m.meter_name)}>
                      <Printer className="w-3 h-3 mr-1" /> พิมพ์
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50" onClick={() => handleDownloadQR(m.location_code, m.meter_name)}>
                      <Download className="w-3 h-3 mr-1" /> โหลดรูป
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 shadow-sm">
          <CardHeader className="bg-slate-50/50">
            <CardTitle className="text-lg flex items-center gap-2"><Scan className="w-5 h-5 text-indigo-600" /> บันทึกมิเตอร์ประจำจุด</CardTitle>
            <CardDescription>กรอกข้อมูลเลขตู้ไฟ ดึงชื่อผู้บันทึกอัตโนมัติ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">เลือกสถานที่/สแกนคิวอาร์โค้ด</label>
              <Select value={selectedMeter} onValueChange={setSelectedMeter}>
                <SelectTrigger>
                  <SelectValue placeholder="--- เลือกสถานที่ประจำจุด ---" />
                </SelectTrigger>
                <SelectContent>
                  {meters.map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>{m.meter_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">ชื่อผู้บันทึก (ระบบล็อกอัตโนมัติ)</label>
              <Input value={userProfile?.name || 'กำลังโหลด...'} disabled className="bg-slate-100 font-medium text-slate-600" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">เลขมิเตอร์ปัจจุบัน (ตัวเลขหน้าปัด)</label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="กรอกเลขมิเตอร์ล่าสุดที่จดได้" />
            </div>

            <Button onClick={() => createLogMutation.mutate()} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium pt-2" disabled={!selectedMeter || !currentValue}>
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
