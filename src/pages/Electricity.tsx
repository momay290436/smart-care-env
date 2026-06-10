import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X } from 'lucide-react';

// ใช้ HTML5-QRCode เพื่อถอดรหัส QR
declare global {
  interface Window { Html5QrcodeScanner: any; }
}

export default function Electricity() {
  const { toast } = useToast();
  const [userName, setUserName] = useState<string>('กำลังโหลดชื่อ...');
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    // โหลด Script ของเครื่องสแกนเมื่อเข้าหน้าเว็บ
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    document.body.appendChild(script);
    
    // ดึงชื่อผู้ใช้... (โค้ดเดิมของคุณ)
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle();
      setUserName(data?.full_name || user.email?.split('@')[0] || 'ผู้ใช้งาน');
    };
    fetchProfile();
  }, []);

  const startScanner = () => {
    setIsScanning(true);
    setTimeout(() => {
      // เรียกใช้เครื่องสแกน บังคับกล้องหลัง (environment)
      const scanner = new window.Html5QrcodeScanner(
        "reader", { fps: 10, qrbox: 250, facingMode: "environment" }
      );
      
      scanner.render((decodedText: string) => {
        // เมื่อสแกนติด
        setSelectedMeter(decodedText);
        toast({ title: "สแกนสำเร็จ", description: `รหัส: ${decodedText}` });
        stopScanner(scanner);
      }, (err: any) => {});
      scannerRef.current = scanner;
    }, 500);
  };

  const stopScanner = (scanner: any) => {
    scanner.clear();
    setIsScanning(false);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader><CardTitle>บันทึกมิเตอร์</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Input disabled value={userName} />
          
          {!isScanning ? (
            <Button onClick={startScanner} className="w-full"><Camera className="mr-2"/> สแกน QR Code</Button>
          ) : (
            <div id="reader" className="w-full"></div>
          )}
          
          {selectedMeter && <div className="p-2 bg-green-100">รหัสที่สแกนได้: {selectedMeter}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
