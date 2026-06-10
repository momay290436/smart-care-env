import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X } from 'lucide-react';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [selectedMeterName, setSelectedMeterName] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. ดึงชื่อ-นามสกุลจากตาราง profiles (คอลัมน์ full_name)
  useEffect(() => {
    const getUserProfileData = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return;

        // ดึงจากตาราง profiles โดยใช้ id ของผู้ใช้
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();

        // ถ้ามีชื่อในโปรไฟล์ให้ใช้ชื่อนั้น ถ้าไม่มีให้ใช้ชื่อหน้าอีเมล
        const displayName = profile?.full_name || (user.email ? user.email.split('@')[0] : 'ผู้ใช้งาน');
        setUserProfile({ id: user.id, name: displayName });
      } catch (err) {
        console.error("Error fetching profile:", err);
      }
    };
    getUserProfileData();
  }, []);

  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('electricity_logs')
        .select('*, electricity_meters (meter_name)')
        .order('created_at', { ascending: false });
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
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (e) {
        setIsScanning(false);
        toast({ variant: "destructive", title: "เปิดกล้องไม่ได้", description: "กรุณาให้สิทธิ์เข้าถึงกล้อง" });
      }
    }, 100);
  };

  const createLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeter,
        current_value: parseFloat(currentValue),
        recorded_by_name: userProfile?.name // บันทึกชื่อ-นามสกุลลงใน log
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "สำเร็จ", description: "บันทึกข้อมูลแล้ว" });
      setCurrentValue('');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-t-4 border-t-indigo-600">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600"><Camera className="mr-2" /> เปิดกล้องสแกน QR</Button>
            ) : (
              <div className="relative overflow-hidden rounded-lg">
                <video ref={videoRef} autoPlay playsInline className="w-full h-48 bg-black" />
                <Button onClick={() => { streamRef.current?.getTracks().forEach(t => t.stop()); setIsScanning(false); }} className="absolute top-2 right-2" variant="destructive" size="icon"><X/></Button>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-sm font-medium">ชื่อผู้บันทึก</label>
              <Input disabled value={userProfile?.name || 'กำลังโหลด...'} />
            </div>
            
            <Input type="number" placeholder="เลขมิเตอร์ปัจจุบัน" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={() => createLogMutation.mutate()} className="w-full" disabled={!currentValue}>บันทึกข้อมูล</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>ชื่อผู้บันทึก</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                </TableRow>
              </TableHeader>
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
