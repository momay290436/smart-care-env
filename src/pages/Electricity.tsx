import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export default function Electricity() {
  const { toast } = useToast();
  const [selectedMeterId, setSelectedMeterId] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [recordDate, setRecordDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isFirstRecord, setIsFirstRecord] = useState<boolean>(false);
  const [customPrevValue, setCustomPrevValue] = useState<string>('0');
  const [customPrevWaterValue, setCustomPrevWaterValue] = useState<string>('0');

  // ฟังก์ชันดึงประวัติและเลขมิเตอร์ยกมา โดยอ้างอิงตามช่วงเดือนของวันที่เลือก (recordDate)
  const checkMeterHistory = async (meterId: string, targetDateStr: string = recordDate) => {
    try {
      const targetDate = new Date(targetDateStr);
      const currentMonthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1).toISOString();

      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value, current_water_value')
        .eq('meter_id', meterId)
        .lt('created_at', currentMonthStart)
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
    } catch (err) {
      // Silently handle error
    }
  };

  // อัปเดตข้อมูลยอดยกมาอัตโนมัติเมื่อเปลี่ยนวันที่หรือเปลี่ยนมิเตอร์
  useEffect(() => {
    if (selectedMeterId) {
      checkMeterHistory(selectedMeterId, recordDate);
    }
  }, [recordDate, selectedMeterId]);

  // ฟังก์ชันบันทึกข้อมูล พร้อมระบบล็อกห้ามลงซ้ำในเดือนเดียวกัน
  const handleSave = async () => {
    if (!selectedMeterId || !currentValue) {
      toast({ variant: "destructive", title: "กรุณาสแกนรหัสและระบุเลขมิเตอร์ไฟ" });
      return;
    }

    // ตรวจสอบการลงข้อมูลซ้ำภายในเดือนเดียวกัน
    const selectedDate = new Date(recordDate);
    const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).toISOString();
    const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1).toISOString();

    const { data: existingLogs } = await supabase
      .from('electricity_logs')
      .select('id')
      .eq('meter_id', selectedMeterId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (existingLogs && existingLogs.length > 0) {
      toast({
        variant: "destructive",
        title: "ไม่สามารถบันทึกได้",
        description: "งวดเดือนนี้มีการลงข้อมูลมิเตอร์แล้ว หากต้องการแก้ไขกรุณาแก้ไขในตารางประวัติ"
      });
      return;
    }

    // ดำเนินการบันทึกข้อมูลลงฐานข้อมูลต่อตามปกติ
    try {
      const { error } = await supabase.from('electricity_logs').insert([
        {
          meter_id: selectedMeterId,
          current_value: parseFloat(currentValue),
          previous_value: parseFloat(customPrevValue),
          created_at: new Date(recordDate).toISOString(),
        }
      ]);

      if (error) throw error;

      toast({ title: "บันทึกสำเร็จ!" });
      setCurrentValue('');
      checkMeterHistory(selectedMeterId, recordDate);
    } catch (err: any) {
      toast({ variant: "destructive", title: "เกิดエラーในการบันทึก", description: err.message });
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">บันทึกมิเตอร์ไฟฟ้า</h1>
      
      {/* ส่วนฟอร์มการใช้งานคงเดิม */}
      <div className="space-y-4 bg-white p-6 rounded-lg shadow">
        <div>
          <label className="block text-sm font-medium mb-1">วันที่บันทึก (งวดเดือน)</label>
          <input 
            type="date" 
            value={recordDate} 
            onChange={(e) => setRecordDate(e.target.value)}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">รหัส/ID มิเตอร์</label>
          <input 
            type="text" 
            placeholder="ระบุหรือสแกนรหัสosมิเตอร์"
            value={selectedMeterId} 
            onChange={(e) => {
              setSelectedMeterId(e.target.value);
              checkMeterHistory(e.target.value, recordDate);
            }}
            className="w-full border p-2 rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">เลขมิเตอร์ยกมา (ดึงอัตโนมัติจากเดือนก่อน): {customPrevValue}</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">เลขมิเตอร์ปัจจุบัน</label>
          <input 
            type="number" 
            value={currentValue} 
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="กรอกเลขปัจจุบัน"
            className="w-full border p-2 rounded"
          />
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700 transition"
        >
          บันทึกข้อมูล
        </button>
      </div>
    </div>
  );
}
