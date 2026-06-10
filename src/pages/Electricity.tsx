import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // แยก state สำหรับใช้บันทึก (ID) และใช้แสดงผลให้ผู้ใช้เห็น (ชื่อ + เลขเครื่อง)
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [meterDisplayName, setMeterDisplayName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });

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

  // ฟังก์ชันเริ่มสแกน QR Code และค้นหาแบบระมัดระวังเป็นพิเศษ
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

          // แก้ไข: ใช้ .limit(1).maybeSingle() เพื่อตัดปัญหา Multiple Rows และรองรับการดึงข้อมูลจาก URL
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`qr_url.eq."${decodedText}",location_code.eq."${decodedText}"`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error("Error fetching meter:", error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการตรวจสอบข้อมูลสถานที่" });
            return;
          }

          if (meterData) {
            setSelectedMeterId(meterData.id);
            setMeterDisplayName(`${meterData.meter_name} (S/N: ${meterData.serial_number || 'ไม่มีข้อมูล'})`);
            toast({ title: "พบข้อมูลสถานที่", description: `เลือกจุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('ไม่พบข้อมูลสถานที่นี้ในระบบ (โปรดลงทะเบียนก่อน)');
            toast({ 
              variant: "destructive", 
              title: "ไม่พบข้อมูล", 
              description: "รหัสหรือ URL นี้ยังไม่ได้ทำการเพิ่มสถานที่" 
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

  // ฟังก์ชันบันทึกข้อมูลลงฐานข้อมูลประวัติ
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสสถานที่ที่ถูกต้องและระบุเลขมิเตอร์" });
      return;
    }

    try {
      // ค้นหาค่าก่อนหน้าของมิเตอร์ไอดีนี้
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeterId) 
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const currentVal = parseFloat(currentValue);
      const units = Math.max(0, currentVal - prevVal); // ป้องกันค่าติดลบที่ทำให้ Check Constraint ใน Database บั๊ก

      // ดึงเฉพาะชื่อสถานที่เพียวๆ ออกมาเก็บในคอลัมน์ meter_name เพื่อใช้แสดงในตารางประวัติ
      const cleanMeterName = meterDisplayName.split(' (S/N:')[0];

      const { error } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        previous_value: prevVal,
        current_value: currentVal,
        units_used: units,
        meter_name: cleanMeterName
      }]);

      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลมิเตอร์สำเร็จแล้ว" });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      console.error(err);
      toast({ 
        variant: "destructive", 
        title: "บันทึกไม่สำเร็จ", 
        description: err.message || "กรุณาตรวจสอบโครงสร้างของคอลัมน์ใหม่อีกครั้ง"
