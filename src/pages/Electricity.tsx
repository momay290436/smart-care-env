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
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => (await supabase.from('electricity_logs').select('*').order('created_at', { ascending: false })).data || [] 
  });

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

          // แก้ไขจุดนี้: เปลี่ยนเป็นดึงรายการแรกที่เจอเพื่อป้องกัน Error Multiple Rows
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`qr_url.eq."${decodedText}",location_code.eq."${decodedText}"`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error("Error fetching meter:", error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูล" });
            return;
          }

          if (meterData) {
            setSelectedMeterId(meterData.id);
            setMeterDisplayName(`${meterData.meter_name} (S/N: ${meterData.serial_number || 'ไม่มีข้อมูล'})`);
            toast({ title: "พบข้อมูลสถานที่", description: `ยินดีต้อนรับสู่: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('ไม่พบข้อมูลสถานที่นี้ในระบบ (กรุณาเพิ่มสถานที่ก่อน)');
            toast({ 
              variant: "destructive", 
              title: "ไม่พบข้อมูล", 
              description: "ลิงก์หรือรหัส QR นี้ยังไม่ได้ผูกกับสถานที่ใดๆ" 
            });
          }
        }, 
        (err) => {}
      ).catch((err) => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสที่ถูกต้องและระบุเลขมิเตอร์" });
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

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: units,
        meter_name: meterDisplayName.split(' (S/N:')[0] 
      }]);

      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลมิเตอร์สำเร็จแล้ว" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "บันทึกไม่สำเร็จ", 
        description: err.message 
      });
    }
  };

  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.qr_url) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อสถานที่และ URL สำหรับ QR Code" });
      return;
    }

    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code,
        serial_number: newMeter.serial,
        qr_url: newMeter.qr_url 
      }]);
      
      if (error) throw error;

      toast({ title: "เพิ่มสถานที่ใหม่สำเร็จเรียบร้อย" });
      setNewMeter({ name: '', code: '', serial: '', qr_url: '' });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
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
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งใหม่</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="ชื่อสถานที่" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                <Input placeholder="รหัส QR" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                <Input placeholder="หมายเลขเครื่องมิเตอร์" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                <Input placeholder="URL สำหรับ QR Code" value={newMeter.qr_url} onChange={(e) => setNewMeter({...newMeter, qr_url: e.target.value})} />
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
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"><Camera className="mr-2"/> สแกน QR Code</Button>
            ) : (
              <div className="relative h-[300px] border-4 border-indigo-500 rounded-lg overflow-hidden">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2" size="sm" variant="destructive"><X/></Button>
              </div>
            )}
            <Input value={meterDisplayName} placeholder="ข้อมูลสถานที่และมิเตอร์จะปรากฏที่นี่หลังจากสแกน" readOnly className="bg-gray-50 text-center font-medium" />
            <Input type="number" value={currentValue} placeholder="กรอกตัวเลขมิเตอร์ไฟฟ้าปัจจุบัน" onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">บันทึก</Button>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleString('th-TH')}</TableCell>
                    <TableCell className="font-medium">{log.meter_name || 'ไม่ทราบสถานที่'}</TableCell>
                    <TableCell className="text-right">เลขมิเตอร์: {log.current_value}</TableCell>
                    <TableCell className="text-right text-emerald-600">ใช้ไป: {log.units_used} หน่วย</TableCell>
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
