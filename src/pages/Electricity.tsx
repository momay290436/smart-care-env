import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Calendar, MapPin, Zap } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับจัดการการสแกนและการบันทึกค่ามิเตอร์
  const [selectedMeterId, setSelectedMeterId] = useState('');
  const [meterDisplayName, setMeterDisplayName] = useState('');
  const [currentValue, setCurrentValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับฟอร์มเพิ่มสถานที่ใหม่และรับรูป QR Code
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงประวัติการบันทึกทั้งหมดจากตาราง electricity_logs
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => {
      const { data } = await supabase
        .from('electricity_logs')
        .select('*')
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // ฟังก์ชันสแกนและแปลงลิงก์ QR Code เป็นชื่อสถานที่ในระบบ
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

          const rawText = decodedText.trim();

          // ทำการค้นหาในตาราง electricity_meters ว่าลิงก์หรือรหัสที่สแกนได้ ตรงกับ qr_url หรือ location_code ไหน
          const { data: meterData, error } = await supabase
            .from('electricity_meters')
            .select('*')
            .or(`qr_url.eq."${rawText}",location_code.eq."${rawText}"`)
            .limit(1)
            .maybeSingle();

          if (error) {
            console.error(error);
            toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" });
            return;
          }

          if (meterData) {
            // บันทึก ID ของมิเตอร์ และดึงชื่อสถานที่จริงมาโชว์ในกล่องข้อความ
            setSelectedMeterId(meterData.id);
            setMeterDisplayName(meterData.meter_name);
            toast({ title: "พบข้อมูลจุดติดตั้ง", description: `สถานที่: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูลสถานที่", description: `รหัสนี้ยังไม่ได้ผูกในระบบ: ${rawText}` });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเข้าถึงกล้องถ่ายภาพได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // ฟังก์ชันบันทึกตัวเลขมิเตอร์ไฟฟ้า พร้อมคำนวณผลต่างอัตโนมัติ
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกน QR และกรอกเลขมิเตอร์ปัจจุบันก่อนบันทึก" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);

      // 1. ดึงข้อมูลการบันทึกครั้งล่าสุดของมิเตอร์ตัวนี้เพื่อเอาค่าเก่ามาลบ
      const { data: lastLog, error: fetchError } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      const prevVal = lastLog?.current_value || 0;
      // 2. คำนวณหน่วยที่ใช้: เลขปัจจุบัน - เลขครั้งก่อน (ถ้าไม่มีค่าเก่า ให้ถือว่าเป็น 0)
      const unitsUsed = currentVal - prevVal;

      if (unitsUsed < 0) {
        toast({ variant: "destructive", title: "ข้อมูลผิดพลาด", description: "เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าค่าครั้งก่อนหน้า" });
        return;
      }

      // 3. บันทึกข้อมูลลงตาราง electricity_logs ตามโครงสร้างคอลัมน์จริงใน Database
      const { error: insertError } = await supabase.from('electricity_logs').insert([{
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        units_used: unitsUsed,
        meter_name: meterDisplayName // เก็บชื่อสถานที่กำกับไว้เพื่อความสะดวกรวดเร็วในการดึงข้อมูล
      }]);

      if (insertError) throw insertError;
      
      toast({ title: "บันทึกข้อมูลเรียบร้อย", description: `ใช้ไปทั้งหมด ${unitsUsed} หน่วย` });
      setCurrentValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกข้อมูลล้มเหลว", description: err.message });
    }
  };

  // ฟังก์ชันสร้างจุดติดตั้งและสร้างลิงก์สำหรับสร้าง QR Code อัตโนมัติ
  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.serial) {
      toast({ variant: "destructive", title: "กรุณากรอกชื่อสถานที่และหมายเลขเครื่องมิเตอร์" });
      return;
    }

    const cleanSerial = newMeter.serial.trim().toLowerCase();
    const generatedDomainUrl = `${cleanSerial}.lovable.com`;

    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: cleanSerial,
        qr_url: generatedDomainUrl 
      }]);
      
      if (error) throw error;

      // เรียกใช้งาน API ฟรีในการแปลง URL ข้อความเป็นรูปภาพ QR Code ทันทีเพื่อให้ดาวน์โหลดได้
      const qrCodeImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(generatedDomainUrl)}`;
      setGeneratedQrUrl(qrCodeImgApi);

      toast({ title: "เพิ่มสถานที่สำเร็จ", description: "ระบบสร้างคิวอาร์โค้ดให้แล้ว สามารถกดดาวน์โหลดได้ทันที" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
    }
  };

  // ฟังก์ชันดาวน์โหลดภาพ QR Code ออกมาเป็นไฟล์นามสกุล .png
  const downloadQrCode = async () => {
    if (!generatedQrUrl) return;
    try {
      const response = await fetch(generatedQrUrl);
      const blob = await response.blob();
      const blobURL = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobURL;
      link.download = `QR_${newMeter.name || 'meter'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // ล้างข้อมูลฟอร์มหลังจากทำงานเสร็จ
      setNewMeter({ name: '', code: '', serial: '' });
      setGeneratedQrUrl('');
    } catch (error) {
      toast({ variant: "destructive", title: "ดาวน์โหลดล้มเหลว", description: "ไม่สามารถบันทึกภาพลงเครื่องได้ กรุณาลองอีกครั้ง" });
    }
  };

  const exportExcel = () => {
