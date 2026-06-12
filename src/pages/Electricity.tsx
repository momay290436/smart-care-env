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
  
  const [selectedMeterId, setSelectedMeterId] = useState(''); 
  const [meterDisplayName, setMeterDisplayName] = useState(''); 
  const [currentValue, setCurrentValue] = useState(''); 
  const [currentWaterValue, setCurrentWaterValue] = useState(''); 
  const [isScanning, setIsScanning] = useState(false);

  const [recordDate, setRecordDate] = useState(() => {
    const today = new Date();
    const offset = today.getTimezoneOffset();
    const localToday = new Date(today.getTime() - (offset * 60 * 1000));
    return localToday.toISOString().split('T')[0];
  });

  const [isFirstRecord, setIsFirstRecord] = useState(false);
  const [customPrevValue, setCustomPrevValue] = useState('');
  const [customPrevWaterValue, setCustomPrevWaterValue] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [newMeter, setNewMeter] = useState({ name: '', code: '', serial: '', qr_url: '' });
  const [generatedQrUrl, setGeneratedQrUrl] = useState('');

  const isShop = meterDisplayName.includes('(ร้านค้า)');

  useEffect(() => {
    const script = document.createElement('script');
    script.src = "https://unpkg.com/html5-qrcode";
    script.async = true;
    document.body.appendChild(script);
  }, []);

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

  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    if (startDate && logDate < startDate) return false;
    if (endDate && logDate > endDate) return false;
    return true;
  });

  const currentMonthStats = React.useMemo(() => {
    const now = new Date();
    let currentYear = now.getFullYear();
    if (currentYear > 2500) currentYear -= 543;
    const currentMonth = now.getMonth(); 

    let totalElectricUnits = 0;
    let totalWaterUnits = 0;

    logs.forEach((log: any) => {
      if (!log.created_at) return;
      const logDate = new Date(log.created_at);
      let logYear = logDate.getFullYear();
      if (logYear > 2500) logYear -= 543;

      if (logYear === currentYear && logDate.getMonth() === currentMonth) {
        totalElectricUnits += log.units_used || 0;
        if (log.current_water_value && log.previous_water_value) {
          const waterDiff = log.current_water_value - log.previous_water_value;
          totalWaterUnits += waterDiff;
        }
      }
    });

    return {
      electric: totalElectricUnits.toLocaleString(),
      water: totalWaterUnits.toLocaleString(),
      monthName: now.toLocaleString('th-TH', { month: 'long', year: 'numeric' })
    };
  }, [logs]);

  const checkMeterHistory = async (meterId: string) => {
    const { data: lastLog } = await supabase
      .from('electricity_logs')
      .select('current_value, current_water_value')
      .eq('meter_id', meterId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!lastLog) {
      setIsFirstRecord(true);
      setCustomPrevValue('0');
      setCustomPrevWaterValue('0');
    } else {
      setIsFirstRecord(false);
      setCustomPrevValue(lastLog.current_value.toString());
      setCustomPrevWaterValue(lastLog.current_water_value ? lastLog.current_water_value.toString() : '0');
    }
  };

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
          const { data: meterData } = await supabase.from('electricity_meters').select('*').eq('qr_url', decodedText.trim()).limit(1).maybeSingle();
          if (meterData) {
            setSelectedMeterId(meterData.id); 
            setMeterDisplayName(meterData.meter_name); 
            await checkMeterHistory(meterData.id);
          }
        }, 
        () => {}
      );
    }, 500);
  };

  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาระบุข้อมูลให้ครบ" });
      return;
    }

    const currentVal = parseFloat(currentValue);
    const prevVal = parseFloat(customPrevValue) || 0;
    const unitsUsed = currentVal - prevVal; // ปรับให้คำนวณตามค่าจริงแม้จะติดลบ

    const insertData: any = {
      meter_id: selectedMeterId,
      current_value: currentVal,
      previous_value: prevVal,
      units_used: unitsUsed,
      created_at: new Date(recordDate).toISOString()
    };

    if (isShop) {
      const currentWaterVal = parseFloat(currentWaterValue) || 0;
      const prevWaterVal = parseFloat(customPrevWaterValue) || 0;
      insertData.current_water_value = currentWaterVal;
      insertData.previous_water_value = prevWaterVal;
    }

    const { error } = await supabase.from('electricity_logs').insert([insertData]);
    if (error) {
      toast({ variant: "destructive", title: "บันทึกข้อมูลไม่สำเร็จ", description: error.message });
    } else {
      toast({ title: "บันทึกข้อมูลสำเร็จ" });
      setCurrentValue('');
      setCurrentWaterValue('');
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border">
        <h1 className="text-2xl font-bold mb-4">ระบบบริหารจัดการมิเตอร์</h1>
        
        <div className="space-y-4">
          <Button onClick={startScanner} className="w-full">สแกน QR Code</Button>
          {isScanning && <div id="reader" className="w-full aspect-square bg-black"></div>}
          
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
          <Input placeholder="สถานที่" value={meterDisplayName} readOnly />
          <Input type="number" placeholder="เลขไฟฟ้าล่าสุด" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          
          {isShop && (
            <Input type="number" placeholder="เลขน้ำล่าสุด" value={currentWaterValue} onChange={(e) => setCurrentWaterValue(e.target.value)} />
          )}

          <Button onClick={handleSave} className="w-full bg-emerald-600">บันทึกข้อมูล</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableBody>
            {filteredLogs.map((log: any) => (
              <TableRow key={log.id}>
                <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                <TableCell>{log.electricity_meters?.meter_name}</TableCell>
                <TableCell>{log.units_used}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
