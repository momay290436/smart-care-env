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
  
  // States สำหรับเก็บข้อมูลมิเตอร์ไฟและน้ำ
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); 
  const [isScanning, setIsScanning] = useState(false);

  // States สำหรับระบุช่วงวันที่เพื่อใช้กรองข้อมูลด้านบนตารางประวัติ
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // States สำหรับสร้างจุดติดตั้งและคิวอาร์โค้ด
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตรวจสอบความเป็นประเภทร้านค้าหรือไม่
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  // ดึงหน้าจอขึ้นไปส่วนบนสุดทันทีเมื่อโหลดเข้าหน้าระบบไฟฟ้านี้
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // ดึงประวัติการบันทึกทั้งหมด
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
          units_used,
          current_water_value,
          previous_water_value,
          created_at,
          electricity_meters (
            meter_name
          )
        `)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  // 1. ตัวกรองข้อมูล (Filter Data) ตามช่วงวันที่เลือก
  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  // 2. คำนวณยอด KPI สรุปของเดือนปัจจุบัน (รองรับการแปลงปี พ.ศ. และ ค.ศ. อย่างปลอดภัย)
  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (currentYear > 2500) currentYear -= 543; // ดักแปลงถ้าเครื่องผู้ใช้เป็นปี พ.ศ.
    const currentMonth = now.getMonth(); 

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      if (logYear > 2500) logYear -= 543; // แปลงให้เป็น ค.ศ. เท่ากันเพื่อเทียบค่า

      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        // รวมหน่วยไฟฟ้าที่ใช้ประจำงวด
        totalElectricUnits += log.units_used || 0;
        
        // รวมหน่วยค่าน้ำประจำงวด (ล่าสุด - ครั้งก่อน)
        if (log.current_water_value && log.previous_water_value) {
          const waterDiff = log.current_water_value - log.previous_water_value;
          if (waterDiff > 0) totalWaterUnits += waterDiff;
        }
      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      water: totalWaterUnits.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

  // ฟังก์ชันสแกนคิวอาร์ (ล็อกกรอบสี่เหลี่ยมจัตุรัสตามมาตรฐาน QR Code สำหรับมือถือ)
  const startScanner = () => {
    setIsScanning(true);
    setCurrentWaterValue('');
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = minDimension < 250 ? minDimension : 250;
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
            toast({ title: "เชื่อมต่อสำเร็จ", description: `จุดติดตั้ง: ${meterData.meter_name}` });
          } else {
            setSelectedMeterId('');
            setMeterDisplayName('');
            toast({ variant: "destructive", title: "ไม่พบข้อมูล", description: `ลิงก์ QR นี้ยังไม่ได้ผูกในระบบ: ${rawText}` });
          }
        }, 
        () => {}
      ).catch(() => {
        toast({ variant: "destructive", title: "ไม่สามารถเปิดกล้องได้" });
        setIsScanning(false);
      });
    }, 500);
  };

  // จัดเก็บข้อมูลลงฐานข้อมูล (ปลดล็อกระบบแจ้งเตือน ปล่อยผ่าน 100%)
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและระบุเลขมิเตอร์ไฟ" });
      return;
    }

    try {
      const currentVal = parseFloat(currentValue);

      // ดึงข้อมูลครั้งก่อนหน้ามาทำประวัติเฉย ๆ ไม่ใช้ล็อกแล้ว
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value, current_water_value')
        .eq('meter_id', selectedMeterId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = lastLog?.current_value || 0;
      const prevWaterVal = lastLog?.current_water_value || 0;

      // คำนวณส่วนต่างหน่วยแบบปลอดภัย ถ้าค่าน้อยกว่าครั้งก่อนให้ใส่เป็น 0 หน่วยแทนการติดลบ
      const calculatedUnits = currentVal >= prevVal ? (currentVal - prevVal) : 0;

      const insertData: any = {
        meter_id: selectedMeterId,
        current_value: currentVal,
        previous_value: prevVal,
        units_used: calculatedUnits
      };

      if (isShop) {
        // หากเป็นร้านค้า ให้ดึงค่าน้ำมาบันทึกคู่กัน (ถ้าไม่กรอกให้ใช้ค่าเดิมหรือ 0)
        const currentWaterVal = currentWaterValue ? parseFloat(currentWaterValue) : prevWaterVal;
        insertData.current_water_value = currentWaterVal;
        insertData.previous_water_value = prevWaterVal;
      }

      const { error } = await supabase.from('electricity_logs').insert([insertData]);
      if (error) throw error;
      
      toast({ title: "บันทึกข้อมูลเสร็จสิ้นเรียบร้อยแล้ว" });
      setCurrentValue('');
      setCurrentWaterValue('');
      setSelectedMeterId('');
      setMeterDisplayName('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err: any) {
      toast({ variant: "destructive", title: "บันทึกไม่สำเร็จ", description: err.message });
    }
  };

  // เพิ่มสถานที่ปฏิบัติงานใหม่
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
      toast({ title: "เพิ่มสถานที่สำเร็จ" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "เพิ่มสถานที่ล้มเหลว", description: err.message });
    }
  };

  const downloadQrCode = async () => {
    if (!generatedQrUrl) return;
    try {
      const response = await
