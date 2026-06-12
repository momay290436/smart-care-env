import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Droplet, Zap, Calendar, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';

declare global { interface Window { Html5Qrcode: any; } }

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // States สำหรับบันทึกข้อมูลหลัก
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); 
  const [isScanning, setIsScanning] = useState(false);

  // State สำหรับปฏิทินลงข้อมูลย้อนหลัง (ค่าเริ่มต้นเป็นวันที่ปัจจุบันในรูปแบบ YYYY-MM-DD)
  const [recordDate, setRecordDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  // States พิเศษสำหรับจัดการข้อมูลครั้งแรกที่ดึงมาจากกระดาษ
  const [isFirstRecord, setIsFirstRecord] = useState(false);
  const [customPrevValue, setCustomPrevValue] = useState('');

  // States สำหรับระบบคัดกรองปฏิทิน
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // States สำหรับการลงทะเบียนเครื่องมิเตอร์ใหม่
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตัวแปรเช็กกลุ่มร้านค้า
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ดึงประวัติรายการทั้งหมดจาก Supabase (ดึงเฉพาะฟิลด์ไฟฟ้าหลักที่มีอยู่จริงชัวร์ๆ เพื่อป้องกัน Error)
  const { data: logs = [] } = useQuery({ 
    queryKey: ['logs'], 
    queryFn: async () => {
      const { data } = await supabase
        .from('electricity_logs')
        .select(`
          id,
          meter_id,
          current_value,
          previous_value,
          created_at,
          electricity_meters (
            meter_name
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // ฟังก์ชันช่วยคำนวณส่วนต่างไฟฟ้า (รองรับมิเตอร์ 4 หลักหมุนรอบ 9999 -> 0000)
  const calculateElectricUnits = (current: number, previous: number) => {
    if (current >= previous) {
      return current - previous;
    } else if (previous > 9000 && current < 1000) {
      return (10000 - previous) + current;
    }
    return 0;
  };

  // ระบบคัดกรองข้อมูลประวัติด้วยวันที่
  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  // คำนวณสรุปหน่วยไฟฟ้าประจำเดือนล่าสุดบนหน้าจอ
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (currentYear > 2500) currentYear -= 543;
    const currentMonth = now.getMonth(); 

    let totalElectricUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      if (logYear > 2500) logYear -= 543;

      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        totalElectricUnits += calculateElectricUnits(log.current_value || 0, log.previous_value || 0);
      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

  // ฟังก์ชันวิเคราะห์ประวัติย้อนหลังของมิเตอร์เพื่อเปิดฟอร์มแก้เลขตั้งต้น
  const checkMeterHistory = async (meterId: string) => {
    try {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', meterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!lastLog) {
        setIsFirstRecord(true);
        setCustomPrevValue('0');
      } else {
        setIsFirstRecord(false);
        setCustomPrevValue(lastLog.current_value.toString());
      }
    } catch (err) {
      console.error("History verification error:", err);
    }
  };

  // เรียกใช้งานโมดูลกล้องเพื่อสแกน QR Code หน้างาน
  const startScanner = () => {
    setIsScanning(true);
    setCurrentWaterValue('');
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          aspectRatio: 1.0, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.72); 
            return { width: boxSize, height: boxSize };
          }
        }, 
        async (decodedText: string) => { 
          setIsScanning(false); 
          html5QrCode.stop(); 

          const rawText = decodedText.trim();
          const { data: meterData } = await supabase
            .from('electricity_meters')
            .select('*')
            .eq('qr_url', rawText)
            .limit(1)
            .maybeSingle();

          if (meterData) {
            setSelectedMeterId(meterData.id); 
            setMeterDisplayName(meterData.meter_name); 
            await checkMeterHistory(meterData.id);
            toast({ title: "เชื่อมต่อสำเร็จ", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูล", description: "ลิงก์คิวอาร์โค้ดนี้ยังไม่ได้ผูกในระบบ" });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดใช้งานกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // ดำเนินการบันทึกข้อมูลเข้าสู่ฐานข้อมูล (ปลอดภัยไร้กังวล ส่งเฉพาะค่าไฟหลักที่มีจริง)
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและระบุเลขมิเตอร์ไฟ" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);
      const prevVal = parseFloat(customPrevValue) || 0;

      if (currentVal < prevVal && !(prevVal > 9000 && currentVal < 1000)) {
        toast({ variant: "destructive", title: "ข้อมูลผิดพลาด", description: `เลขมิเตอร์ไฟฟ้าน้อยกว่าครั้งก่อนหน้า (${prevVal})` });
        return;
      }

      const currentTimeStr = new Date().toTimeString().split(' ')[0]; 
      const finalCreatedAt = new Date(`${recordDate}T${currentTimeStr}`).toISOString();

      // บันทึกเฉพาะฟิลด์ที่มีในตารางจริง ไม่ส่งฟิลด์น้ำไปให้ระบบเออร์เรอร์อีก
      const insertData: any = {
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        created_at: finalCreatedAt 
      };

      const { error } = await supabase.from('electricity_logs').insert([insertData]);
      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลสำเร็จเรียบร้อย" });
      
      // ล้างข้อมูลหลังบันทึกเสร็จ
      setCurrentValue('');
      setCurrentWaterValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      setIsFirstRecord(false);
      
      const today = new Date();
      const offset = today.getTimezoneOffset();
      const localToday = new Date(today.getTime() - (offset * 60 * 1000));
      setRecordDate(localToday.toISOString().split('T')[0]);

      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาดในการบันทึก", description: err.message });
    }
  };

  // เพิ่มจุดจดบันทึกตัวใหม่เข้าระบบ
  const handleSaveMeter = async () => {
    if (!newMeter.name || !newMeter.serial) {
      toast({ variant: "destructive", title: "กรุณาระบุชื่อสถานที่และรหัสมิเตอร์" });
      return;
    }

    const cleanSerial = newMeter.serial.trim().toLowerCase();
    const autoQrUrl = `${cleanSerial}.lovable.com`;

    try {
      const { error } = await supabase.from('electricity_meters').insert([{ 
        meter_name: newMeter.name, 
        location_code: newMeter.code || cleanSerial, 
        qr_url: autoQrUrl
      }]);
      
      if (error) throw error;

      const qrCodeImgApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(autoQrUrl)}`;
      setGeneratedQrUrl(qrCodeImgApi);
      toast({ title: "เพิ่มจุดตรวจสอบสำเร็จ" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "การบันทึกจุดจดล้มเหลว", description: err.message });
    }
  };

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
      setNewMeter({ name: '', code: '', serial: '', qr_url: '' });
      setGeneratedQrUrl('');
    } catch {
      toast({ variant: "destructive", title: "ดาวน์โหลดรูปคิวอาร์โค้ดไม่สำเร็จ" });
    }
  };

  // ส่งออกไฟล์รายงานสรุปแยกหมวดหมู่ตามวงเล็บท้ายชื่อแบบเสถียร
  const exportExcel = () => {
    const formatLogItem = (log: any) => {
      const elecDiff = calculateElectricUnits(log.current_value || 0, log.previous_value || 0);
      return {
        'วัน-เวลาที่จด': new Date(log.created_at).toLocaleString('th-TH'),
        'สถานที่ติดตั้ง': log.electricity_meters?.meter_name || 'ไม่พบข้อมูล',
        'เลขมิเตอร์ไฟครั้งก่อน': log.previous_value,
        'เลขมิเตอร์ไฟล่าสุด': log.current_value,
        'จำนวนหน่วยไฟที่ใช้ประจำงวด (หน่วย)': elecDiff
      };
    };

    const categories = [
      { key: 'ร้านค้า', label: 'ร้านค้า' },
      { key: 'บ้านพัก', label: 'บ้านพัก' },
      { key: 'แฟลต1', label: 'แฟลต1' },
      { key: 'แฟลต2', label: 'แฟลต2' },
      { key: 'แฟลต3', label: 'แฟลต3' },
      { key: 'แฟลต4', label: 'แฟลต4' }
    ];

    const
