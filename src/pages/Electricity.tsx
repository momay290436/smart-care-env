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
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().split('T')[0]);
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
        .select(`*, electricity_meters(meter_name)`)
        .order('created_at', { ascending: false });
      return data || [];
    }
  });

  const filteredLogs = logs.filter((log: any) => {
    if (!startDate && !endDate) return true;
    const logDate = new Date(log.created_at).toISOString().split('T')[0];
    return logDate >= (startDate || '0000-00-00') && logDate <= (endDate || '9999-99-99');
  });

  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) return;
    
    const curVal = parseFloat(currentValue);
    const prevVal = parseFloat(customPrevValue) || 0;
    const unitsUsed = 10000 - prevVal + curVal;

    const data: any = {
      meter_id: selectedMeterId,
      current_value: curVal,
      previous_value: prevVal,
      units_used: unitsUsed,
      created_at: new Date(recordDate).toISOString()
    };

    if (isShop) {
      data.current_water_value = parseFloat(currentWaterValue) || 0;
      data.previous_water_value = parseFloat(customPrevWaterValue) || 0;
    }

    const { error } = await supabase.from('electricity_logs').insert([data]);
    if (!error) {
      toast({ title: "บันทึกสำเร็จ" });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">ระบบบริหารจัดการมิเตอร์</h1>
      <Card>
        <CardContent className="pt-6 space-y-4">
          <Input type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
          <Input placeholder="เลขมิเตอร์ล่าสุด" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
          <Button onClick={handleSave} className="w-full">ยืนยันและบันทึก</Button>
        </CardContent>
      </Card>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>สถานที่</TableHead>
            <TableHead>เลขก่อนหน้า</TableHead>
            <TableHead>เลขล่าสุด</TableHead>
            <TableHead>หน่วยที่ใช้</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredLogs.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell>{log.electricity_meters?.meter_name}</TableCell>
              <TableCell>{log.previous_value}</TableCell>
              <TableCell>{log.current_value}</TableCell>
              <TableCell className="font-bold">{log.units_used}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
