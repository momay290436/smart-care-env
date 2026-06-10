import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeter, setSelectedMeter] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const { data: logs = [] } = useQuery({ queryKey: ['logs'], queryFn: async () => (await supabase.from('electricity_logs').select('*')).data || [] });

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: 250 }, 
        (text: string) => { setSelectedMeter(text); setIsScanning(false); html5QrCode.stop(); }, () => {}
      );
    }, 500);
  };

  // 1. ฟังก์ชันบันทึกข้อมูล (แก้ให้ทำงานจริง)
  const handleSave = async () => {
    if (!selectedMeter || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและใส่เลขมิเตอร์" });
      return;
    }

    try {
      // ดึงค่าล่าสุดมาคำนวณ
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_name', selectedMeter)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const currentVal = parseFloat(currentValue);

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_name: selectedMeter,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: currentVal - prevVal,
      }]);

      if (error) throw error;
      toast({ title: "บันทึกสำเร็จ" });
      setCurrentValue('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: "ตรวจสอบตาราง Database ว่ามีคอลัมน์ครบไหม" });
    }
  };

  // 2. ฟังก์ชันบันทึกสถานที่ใหม่ (แก้ให้ต่อ Database จริง)
  const handleSaveMeter = async () => {
    const { error } = await supabase.from('electricity_meters').insert([{ 
      meter_name: newMeter.name, 
      location_code: newMeter.code,
      serial_number: newMeter.serial,
      qr_url: newMeter.qr_url 
    }]);
    
    if (error) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: error.message });
    } else {
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
      setNewMeter({ name: '', code: '', serial: '', qr_url: '' });
    }
  };

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(logs);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Logs");
    XLSX.writeFile(wb, "History.xlsx");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ระบบบันทึกไฟฟ้า</h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2"/> Export</Button>
          <Dialog>
            <DialogTrigger asChild><Button><Plus className="mr-2" /> เพิ่มสถานที่</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้ง</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="ชื่อสถานที่" onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                <Input placeholder="รหัส QR" onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                <Input placeholder="หมายเลขเครื่องมิเตอร์" onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                <Input placeholder="URL สำหรับ QR Code" onChange={(e) => setNewMeter({...newMeter, qr_url: e.target.value})} />
                <Button className="w-full" onClick={handleSaveMeter}>บันทึกสถานที่</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full"><Camera className="mr-2"/> สแกน QR Code</Button>
            ) : (
              <div className="relative h-[300px] border-4 border-indigo-500 rounded-lg overflow-hidden">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2" size="sm" variant="destructive"><X/></Button>
              </div>
            )}
            <Input value={selectedMeter} placeholder="รหัสที่สแกนได้" readOnly />
            <Input type="number" placeholder="เลขมิเตอร์" onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={handleSave} className="w-full">บันทึก</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.created_at}</TableCell>
                    <TableCell>{log.meter_name}</TableCell>
                    <TableCell>{log.current_value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
