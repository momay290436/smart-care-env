import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Download, Printer, Scan, Camera, X } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [selectedMeterName, setSelectedMeterName] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // สเตตัสการควบคุมกล้องสแกน QR Code
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [localQrDataUrl, setLocalQrDataUrl] = useState<string>('');

  // --- ส่วนที่แก้ไข: สร้าง QR Code ให้สแกนติดจริง 100% ---
  const generateLocalQR = async (text: string): Promise<string> => {
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
      document.body.appendChild(script);
      
      script.onload = () => {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        window.QRCode.toCanvas(canvas, text, { width: 300, margin: 2 }, (error: any) => {
          if (error) console.error(error);
          resolve(canvas.toDataURL('image/png'));
        });
      };
    });
  };

  const handleDownloadQR = async (code: string) => {
    const dataUrl = await generateLocalQR(code);
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QR_${code}.png`;
    link.click();
  };
  // --------------------------------------------------

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        setUserProfile({ id: user.id, name: profile?.full_name || user.email?.split('@')[0] || 'User' });
      }
    };
    getUser();
  }, []);

  const { data: meters = [] } = useQuery({
    queryKey: ['electricity_meters'],
    queryFn: async () => {
      const { data } = await supabase.from('electricity_meters').select('*');
      return data || [];
    }
  });

  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs'],
    queryFn: async () => {
      const { data } = await supabase.from('electricity_logs').select('*, electricity_meters(meter_name)').order('created_at', { ascending: false });
      return data || [];
    }
  });

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {meters.map((meter: any) => (
          <Card key={meter.id} className="p-4 flex justify-between items-center">
            <div>
              <p className="font-bold">{meter.meter_name}</p>
              <p className="text-sm text-gray-500">Code: {meter.location_code}</p>
            </div>
            <Button variant="outline" onClick={() => handleDownloadQR(meter.location_code)}>
              <Download className="w-4 h-4 mr-2" /> โหลด QR
            </Button>
          </Card>
        ))}
      </div>
      
      {/* ส่วนตารางประวัติเดิมของคุณ */}
      <Table>
        <TableBody>
          {logs.map((log: any) => (
            <TableRow key={log.id}>
              <TableCell>{new Date(log.created_at).toLocaleDateString('th-TH')}</TableCell>
              <TableCell>{log.electricity_meters?.meter_name}</TableCell>
              <TableCell>{log.current_value}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
