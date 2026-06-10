import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Download, Camera, X, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });
  const [logs, setLogs] = useState<any[]>([]);

  // ระบบสร้าง QR Code (สแกนติดจริง)
  const generateQR = async (text: string) => {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
    document.body.appendChild(script);
    return new Promise<string>((resolve) => {
      script.onload = () => {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        window.QRCode.toCanvas(canvas, text, { width: 300 }, () => resolve(canvas.toDataURL('image/png')));
      };
    });
  };

  const handleDownloadQR = async (code: string) => {
    const url = await generateQR(code);
    const a = document.createElement('a'); a.href = url; a.download = `QR_${code}.png`; a.click();
  };

  const exportExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(logs);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ElectricityLogs");
    XLSX.writeFile(workbook, "Electricity_Logs.xlsx");
  };

  const { data: meters = [] } = useQuery({
    queryKey: ['meters'],
    queryFn: async () => {
      const { data } = await supabase.from('electricity_meters').select('*');
      return data || [];
    }
  });

  const createMeter = useMutation({
    mutationFn: async () => {
      await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code,
        serial_number: newMeter.serial 
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meters'] });
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
      setNewMeter({ name: '', code: '', serial: '' });
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ระบบจัดการไฟฟ้า</h1>
        <div className="flex gap-2">
          <Button onClick={exportExcel} variant="outline"><FileSpreadsheet className="mr-2"/> Export Excel</Button>
          <Dialog>
            <DialogTrigger asChild><Button><Plus className="mr-2" /> เพิ่มสถานที่</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งใหม่</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <Input placeholder="ชื่อสถานที่" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} />
                <Input placeholder="รหัส QR (Location Code)" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} />
                <Input placeholder="หมายเลขเครื่องมิเตอร์" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} />
                <Button className="w-full" onClick={() => createMeter.mutate()}>บันทึกและสร้าง QR</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-4">
          {meters.map((m: any) => (
            <Card key={m.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-bold">{m.meter_name}</p>
                <p className="text-xs text-gray-500">SN: {m.serial_number}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => handleDownloadQR(m.location_code)}><Download/></Button>
            </Card>
          ))}
        </div>
        
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>ชื่อสถานที่</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any, i: number) => (
                  <TableRow key={i}>
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
