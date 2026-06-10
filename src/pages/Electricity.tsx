import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Camera, X, Download } from 'lucide-react';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ name: string } | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  // ส่วนสร้าง QR Code ที่สแกนติดจริง
  const generateLocalQR = async (text: string) => {
    return new Promise<string>((resolve) => {
      const script = document.createElement('script');
      script.src = "https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js";
      document.body.appendChild(script);
      script.onload = () => {
        const canvas = document.createElement('canvas');
        // @ts-ignore
        window.QRCode.toCanvas(canvas, text, { width: 300, margin: 2 }, () => {
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

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
        setUserProfile({ name: profile?.full_name || user.email?.split('@')[0] || 'User' });
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">จัดการจุดติดตั้งมิเตอร์</h1>
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
    </div>
  );
}
