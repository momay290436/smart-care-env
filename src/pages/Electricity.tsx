import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userName, setUserName] = useState<string>('กำลังโหลดชื่อ...');
  const [currentValue, setCurrentValue] = useState<string>('');

  // ดึงชื่อโดยตรงจากตาราง profiles
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Query เฉพาะคอลัมน์ full_name จากตาราง profiles โดยอ้างอิงจาก id
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error("Error:", error);
      } else if (data && data.full_name) {
        setUserName(data.full_name); // ดึงชื่อจริงมาแสดง
      } else {
        setUserName(user.email || 'ไม่พบชื่อ');
      }
    };
    fetchUserProfile();
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
        recorded_by_name: userName // ใช้ชื่อที่ดึงมาได้จาก state
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ", description: `ผู้บันทึก: ${userName}` });
      setCurrentValue('');
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-gray-500">ผู้บันทึก:</label>
              <Input disabled value={userName} className="bg-gray-50 font-bold text-black" />
            </div>
            <Input type="number" placeholder="เลขมิเตอร์ปัจจุบัน" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={() => createLogMutation.mutate()} className="w-full">บันทึก</Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>ผู้บันทึก</TableHead>
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
