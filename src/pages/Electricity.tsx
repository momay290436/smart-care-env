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

  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  const [printTarget, setPrintTarget] = useState<{ code: string; name: string } | null>(null);
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ดึงชื่อ-นามสกุลจากตาราง profiles
  useEffect(() => {
    const getUserProfileData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        if (profile && profile.full_name) {
          setUserProfile({ id: user.id, name: profile.full_name });
        } else {
          const fallbackName = user.email ? user.email.split('@')[0] : 'ผู้ใช้งานระบบ';
          setUserProfile({ id: user.id, name: fallbackName });
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    };
    getUserProfileData();
  }, []);

  const { data: meters = [] } = useQuery({
    queryKey: ['electricity_meters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('electricity_meters').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('electricity_logs')
        .select('*, electricity_meters (meter_name, location_code)')
        .order('created_at', { ascending: false });
      
      if (dateRange.start) query = query.gte('created_at', dateRange.start);
      if (dateRange.end) query = query.lte('created_at', `${dateRange.end}T23:59:59`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  const startScanner = async () => {
    setIsScanning(true);
    setTimeout(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } }
        }).catch(() => navigator.mediaDevices.getUserMedia({ video: true }));
        
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (e) {
        toast({ variant: "destructive", title: "เปิดกล้องไม่ได้", description: "กรุณาตรวจสอบสิทธิ์เข้าถึงกล้อง" });
        setIsScanning(false);
      }
    }, 100);
  };

  const stopScanner = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    setIsScanning(false);
  };

  const generateLocalQR = (code: string): string => {
    if (!canvasRef.current) return '';
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return '';
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 250, 250);
    ctx.fillStyle = '#000000';
    ctx.fillRect(20, 20, 50, 50); ctx.fillRect(180, 20, 50, 50); ctx.fillRect(20, 180, 50, 50);
    return canvasRef.current.toDataURL('image/png');
  };

  const createLogMutation = useMutation({
    mutationFn: async () => {
      const { data: lastLog } = await supabase.from('electricity_logs').select('current_value').eq('meter_id', selectedMeter).order('created_at', { ascending: false }).limit(1);
      const prevVal = lastLog?.[0]?.current_value || 0;
      const currVal = parseFloat(currentValue);
      if (currVal < prevVal) throw new Error("เลขมิเตอร์ห้ามต่ำกว่าครั้งก่อนหน้า");
      
      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeter, current_value: currVal, previous_value: prevVal,
        recorded_by: userProfile?.id, recorded_by_name: userProfile?.name
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ", description: "ข้อมูลถูกจัดเก็บแล้ว" });
      setCurrentValue(''); setSelectedMeter(''); setSelectedMeterName('');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <canvas ref={canvasRef} width="250" height="250" className="hidden" />
      
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">บันทึกมิเตอร์ไฟฟ้า</h1>
          <p className="text-slate-500">สำหรับจดบันทึกค่ามิเตอร์ประจำจุดต่างๆ</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-t-4 border-t-indigo-600">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600"><Camera className="mr-2" /> เปิดกล้องสแกน QR</Button>
            ) : (
              <div className="relative overflow-hidden rounded-lg">
                <video ref={videoRef} className="w-full h-48 bg-black" />
                <Button onClick={stopScanner} className="absolute top-2 right-2 rounded-full" size="icon" variant="destructive"><X/></Button>
              </div>
            )}
            
            {selectedMeterName && <div className="bg-emerald-50 p-2 text-emerald-700 text-center rounded font-bold">📍 สถานที่: {selectedMeterName}</div>}
            
            <Input disabled value={userProfile?.name || 'กำลังโหลดชื่อ...'} />
            <Input type="number" placeholder="เลขมิเตอร์ปัจจุบัน" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={() => createLogMutation.mutate()} className="w-full" disabled={!selectedMeter || !currentValue}>บันทึก</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>สถานที่</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                  <TableHead>ผู้บันทึก</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{log.electricity_meters?.meter_name}</TableCell>
                    <TableCell>{log.current_value}</TableCell>
                    <TableCell>{log.recorded_by_name}</TableCell>
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
