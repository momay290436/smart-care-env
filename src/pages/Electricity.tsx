import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Calendar, MapPin, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [meterDisplayName, setMeterDisplayName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติการบันทึกข้อมูล
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => (await supabase.from('electricity_logs').select('*').order('created_at', { ascending: false })).data || [] 
  });

  // ฟังก์ชันสแกน QR Code (รองรับการ Match ด้วยรูปแบบ หมายเลขเครื่อง.lovable.com)
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

          // ทำความสะอาดข้อความ (ตัดช่องว่าง หรืออักษรพิมพ์ใหญ่พิมพ์เล็ก)
          const cleanScannedText = decodedText.trim().toLowerCase();

          // ค้นหาในฐานข้อมูลว่ามี qr_url หรือ location_code หรือ serial_number ตรงกับที่สแกนไหม
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`qr_url.eq."${cleanScannedText}",location_code.eq."${cleanScannedText}",serial_number.eq."${cleanScannedText}"`)
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
            toast({ title: "พบข้อมูลสถานที่", description: `เลือกจุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('ไม่พบข้อมูลสถานที่นี้ในระบบ');
            toast({ 
              variant: "destructive", 
              title: "ไม่พบข้อมูล", 
              description: `ไม่พบสถานที่ที่ผูกกับรหัส: ${decodedText}` 
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

  // ฟังก์ชันบันทึกข้อมูลมิเตอร์ไฟฟ้า
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสสถานที่และระบุเลขมิเตอร์" });
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

      const cleanMeterName = meterDisplayName.split(' (S/N:')[0];

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: units,
        meter_name: cleanMeterName
      }]);

      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลสำเร็จ" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
