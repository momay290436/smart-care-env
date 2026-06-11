import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Plus, FileSpreadsheet, Download, Droplet, Zap, Calendar, TrendingUp, Clock } from 'lucide-react';
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

  // State ใหม่: สำหรับระบุวัน-เวลาลงบันทึก (รองรับการใส่ข้อมูลย้อนหลัง)
  const [customDate, setCustomDate] = useState('');

  // States สำหรับระบุช่วงวันที่เพื่อใช้กรองข้อมูลด้านบนตารางประวัติ
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // States สำหรับสร้างจุดติดตั้งและคิวอาร์โค้ด
  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  // ตรวจสอบความเป็นประเภทร้านค้าหรือไม่
  const isShop = meterDisplayName.includes('(ร้านค้า)');

  // ฟังก์ชันตั้งค่าวันเวลาปัจจุบันในฟอร์มย้อนหลังแบบอัตโนมัติ
  const setToCurrentDateTime = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // แปลงเวลาให้ตรงกับ Local Timezone
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    setCustomDate(localISOTime);
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
    setToCurrentDateTime(); // เรียกใช้วันเวลาปัจจุบันตอนเปิดหน้าเว็บ
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

  // ฟังก์ชันสแกนคิวอาร์และตรวจสอบสิทธิ์สถานที่
  const startScanner = () => {
    setIsScanning(true);
    setCurrentWaterValue('');
    setTimeout(() => {
      const html5QrCode = new window.Html5Qrcode("reader");
      html5QrCode.start(
        { facingMode: "environment" }, 
        { 
          fps: 10, 
          aspectRatio: 1.0, // บังคับสัดส่วนช่องพรีวิวภาพกล้องเป็น 1:1 จัตุรัส
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const minDimension = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minDimension * 0.72); // ขนาดกล่องเล็งสีขาวกว้างยาวเท่ากัน 72%
