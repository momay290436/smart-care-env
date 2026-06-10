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
  // ตั้งค่าเริ่มต้นเป็นข้อความรอโหลด
  const [userName, setUserName] = useState<string>('กำลังดึงชื่อผู้ใช้งาน...'); 
  const [userId, setUserId] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ดึงข้อมูลชื่อ-นามสกุลจากตาราง profiles ทันทีที่เข้าหน้าเว็บ
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // ดึงข้อมูลจากตาราง profiles คอลัมน์ full_name
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      if (data && data.full_name) {
        setUserName(data.full_name); // อัปเดตชื่อเมื่อพบข้อมูลในตาราง
      } else {
        setUserName(user.email?.split('@')[0] || 'ผู้ใช้งาน');
      }
    };
    fetchProfile();
  }, []);

  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('electricity_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    }
  });

  const createLogMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('electricity_logs').insert([{
        current_value: parseFloat(currentValue),
        recorded_by_name: userName // ใช้ชื่อที่ได้จาก useEffect
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ", description: `บันทึกโดย: ${userName}` });
      setCurrentValue('');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 border-t-4 border-t-indigo-600">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ชื่อผู้บันทึก</label>
              {/* แสดงชื่อที่ดึงจากตาราง profiles */}
              <Input disabled value={userName} className="font-semibold text-indigo-700 bg-indigo-50" />
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
                    <TableCell className="font-medium">{log.recorded_by_name}</TableCell>
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
