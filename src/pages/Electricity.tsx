import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMeter, setSelectedMeter] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  const { data: meters = [] } = useQuery({ queryKey: ['meters'], queryFn: async () => (await supabase.from('electricity_meters').select('*')).data || [] });
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
              <Input placeholder="ชื่อสถานที่" onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
              <Input placeholder="รหัส QR" onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
              <Button onClick={() => { /* เพิ่ม Logic บันทึกที่นี่ */ }}>บันทึก</Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* ส่วนซ้าย: กล้องและบันทึก */}
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
            <Button className="w-full">บันทึก</Button>
          </CardContent>
        </Card>

        {/* ส่วนขวา: ประวัติ */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.created_at}</TableCell>
                    <TableCell>{log.meter_name}</TableCell>
                    <TableCell>{log.value}</TableCell>
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
