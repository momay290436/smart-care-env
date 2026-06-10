import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, Download } from 'lucide-react';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  // โหลดสคริปต์สแกนเนอร์
  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);

    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        setUserProfile({ id: user.id, name: profile?.full_name || user.email?.split('@')[0] || 'User' });
      }
    };
    getUser();
  }, []);

  const { data: meters = [] } = useQuery({
    queryKey: ['electricity_meters'],
    queryFn: async () => {
      const { data } = await supabase.from('electricity_meters').select('*');
      return data || [];
    }
  });

  const createMeterMutation = useMutation({
    mutationFn: async () => {
      await supabase.from('electricity_meters').insert([{ meter_name: newMeterName, location_code: newMeterCode }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_meters'] });
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
      setNewMeterName(''); setNewMeterCode('');
    }
  });

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(async () => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText: string) => {
          setSelectedMeter(decodedText);
          html5QrCode.stop();
          setIsScanning(false);
          toast({ title: "สแกนสำเร็จ" });
        },
        () => {}
      );
    }, 500);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">ระบบบันทึกไฟฟ้า</h1>
        {/* ปุ่มเพิ่มสถานที่กลับมาแล้ว! */}
        <Dialog>
          <DialogTrigger asChild><Button><Plus className="mr-2" /> เพิ่มสถานที่</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>เพิ่มจุดติดตั้งใหม่</DialogTitle></DialogHeader>
            <Input placeholder="ชื่อสถานที่" value={newMeterName} onChange={(e) => setNewMeterName(e.target.value)} />
            <Input placeholder="รหัส QR" value={newMeterCode} onChange={(e) => setNewMeterCode(e.target.value)} />
            <Button onClick={() => createMeterMutation.mutate()}>บันทึก</Button>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-t-4 border-t-indigo-600">
        <CardContent className="space-y-4 pt-4">
          {!isScanning ? (
            <Button onClick={startScanner} className="w-full"><Camera className="mr-2"/> สแกน QR Code</Button>
          ) : (
            <div className="relative h-[300px] border-4 border-indigo-500 rounded-lg overflow-hidden">
              <div id="reader" className="w-full h-full"></div>
              <Button onClick={() => window.location.reload()} className="absolute top-2 right-2" size="sm" variant="destructive"><X/></Button>
            </div>
          )}
          <Input value={selectedMeter} onChange={(e) => setSelectedMeter(e.target.value)} placeholder="รหัสที่สแกนได้" />
          <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} placeholder="เลขมิเตอร์" />
        </CardContent>
      </Card>
    </div>
  );
}
