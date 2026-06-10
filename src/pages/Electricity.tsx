import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Download, Camera, X } from 'lucide-react';
import * as XLSX from 'xlsx';

// ประกาศตัวแปรเพื่อเรียกใช้สคริปต์สแกนเนอร์
declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);

  useEffect(() => {
    // 1. ดึงชื่อผู้ใช้งาน
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        setUserProfile({ id: user.id, name: profile?.full_name || user.email?.split('@')[0] || 'User' });
      }
    };
    getUser();

    // 2. โหลดสคริปต์สแกนเนอร์เข้าหน้าเว็บ
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ฟังก์ชันเริ่มสแกน
  const startScanner = () => {
    setIsScanning(true);
    setTimeout(async () => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, // บังคับกล้องหลัง
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          setSelectedMeter(decodedText);
          toast({ title: "สแกนสำเร็จ", description: `รหัส: ${decodedText}` });
          html5QrCode.stop();
          setIsScanning(false);
        },
        (err: any) => {}
      ).catch((err: any) => {
        toast({ variant: "destructive", title: "เปิดกล้องไม่ได้", description: "กรุณาตรวจสอบสิทธิ์" });
        setIsScanning(false);
      });
    }, 500);
  };

  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('electricity_logs').select('*').order('created_at', { ascending: false });
      return data || [];
    }
  });

  const createLogMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeter,
        current_value: parseFloat(currentValue),
        recorded_by_name: userProfile?.name
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ" });
      setCurrentValue(''); setSelectedMeter('');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-t-4 border-t-indigo-600">
          <CardHeader><CardTitle>บันทึกมิเตอร์</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input disabled value={userProfile?.name || 'Loading...'} />
            
            {/* พื้นที่สแกนแบบล็อกขนาด (ป้องกัน Layout พัง) */}
            <div className="space-y-2">
              {!isScanning ? (
                <Button onClick={startScanner} className="w-full bg-indigo-600"><Camera className="mr-2"/> เปิดกล้องสแกน QR</Button>
              ) : (
                <div className="relative border-4 border-indigo-500 rounded-lg overflow-hidden h-[300px]">
                  <div id="reader" className="w-full h-full"></div>
                  <Button onClick={() => window.location.reload()} className="absolute top-2 right-2" size="sm" variant="destructive"><X/></Button>
                </div>
              )}
            </div>

            <Input value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)} placeholder="รหัส QR" />
            <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="เลขมิเตอร์" />
            <Button onClick={() => createLogMutation.mutate()} className="w-full">บันทึกข้อมูล</Button>
          </CardContent>
        </Card>
        
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{log.recorded_by_name}</TableCell>
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
