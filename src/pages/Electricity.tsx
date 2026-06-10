import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { QrCode, Plus, Download, Printer, Scan } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function Electricity() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [userProfile, setUserProfile] = useState<{ id: string; name: string } | null>(null);
  const [selectedMeter, setSelectedMeter] = useState<string>('');
  const [currentValue, setCurrentValue] = useState<string>('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  // แอดมินสร้างสถานที่
  const [newMeterName, setNewMeterName] = useState('');
  const [newMeterCode, setNewMeterCode] = useState('');

  // 1. ดึงข้อมูลผู้ใช้งานปัจจุบันที่ล็อกอิน
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const fullName = user.user_metadata?.full_name || user.email || 'ผู้ใช้งานระบบ';
        setUserProfile({ id: user.id, name: fullName });
      }
    };
    getUser();
  }, []);

  // 2. Query ดึงจุดติดตั้งมิเตอร์ทั้งหมด
  const { data: meters = [] } = useQuery({
    queryKey: ['electricity_meters'],
    queryFn: async () => {
      const { data, error } = await supabase.from('electricity_meters').select('*');
      if (error) throw error;
      return data;
    }
  });

  // 3. Query ดึงประวัติการบันทึก
  const { data: logs = [] } = useQuery({
    queryKey: ['electricity_logs', dateRange],
    queryFn: async () => {
      let query = supabase
        .from('electricity_logs')
        .select(`
          *,
          electricity_meters (meter_name, location_code)
        `)
        .order('created_at', { ascending: false });
      
      if (dateRange.start) query = query.gte('created_at', dateRange.start);
      if (dateRange.end) query = query.lte('created_at', `${dateRange.end}T23:59:59`);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    }
  });

  // 4. Mutation สำหรับเพิ่มสถานที่ใหม่ (Admin)
  const createMeterMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('electricity_meters').insert([
        { meter_name: newMeterName, location_code: newMeterCode }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_meters'] });
      toast({ title: "สำเร็จ", description: "เพิ่มจุดติดตั้งมิเตอร์ไฟฟ้าเรียบร้อยแล้ว" });
      setNewMeterName(''); setNewMeterCode('');
    }
  });

  // 5. Mutation สำหรับบันทึกค่ามิเตอร์ (User)
  const createLogMutation = useMutation({
    mutationFn: async () => {
      const { data: lastLog } = await supabase
        .from('electricity_logs')
        .select('current_value')
        .eq('meter_id', selectedMeter)
        .order('created_at', { ascending: false })
        .limit(1);

      const prevVal = lastLog && lastLog.length > 0 ? lastLog[0].current_value : 0;
      const currVal = parseFloat(currentValue);

      if (currVal < prevVal) {
        throw new Error("เลขมิเตอร์ปัจจุบันต้องไม่น้อยกว่าครั้งก่อนหน้า (" + prevVal + ")");
      }

      const { error } = await supabase.from('electricity_logs').insert([
        {
          meter_id: selectedMeter,
          current_value: currVal,
          previous_value: prevVal,
          recorded_by: userProfile?.id,
          recorded_by_name: userProfile?.name
        }
      ]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['electricity_logs'] });
      toast({ title: "บันทึกสำเร็จ", description: "ระบบคำนวณหน่วยไฟที่ใช้เรียบร้อย" });
      setCurrentValue('');
    },
    onError: (error: any) => {
      toast({ variant: "destructive", title: "เกิดข้อผิดพลาด", description: error.message });
    }
  });

  // ฟังก์ชัน Export Excel
  const exportToExcel = () => {
    const dataToExport = logs.map(log => ({
      'วันที่-เวลาที่บันทึก': new Date(log.created_at).toLocaleString('th-TH'),
      'สถานที่/จุดติดตั้ง': log.electricity_meters?.meter_name || 'ไม่ระบุ',
      'รหัสสถานที่': log.electricity_meters?.location_code || '',
      'เลขมิเตอร์ครั้งก่อน': log.previous_value,
      'เลขมิเตอร์ปัจจุบัน': log.current_value,
      'หน่วยที่ใช้จริง (Units)': log.units_used,
      'ผู้จดบันทึก': log.recorded_by_name || 'ไม่ระบุ'
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Electricity Logs");
    XLSX.writeFile(workbook, `รายงานมิเตอร์ไฟฟ้า_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ✨ ฟังก์ชันพิมพ์ QR Code เวอร์ชันปลอดภัยสูงสุด ปลอดภัยจากระบบความปลอดภัย (CSP) 100%
  const printQRCode = (code: string, name: string) => {
    const targetUrl = `${window.location.origin}/electricity?code=${encodeURIComponent(code)}`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
        <head>
          <title>พิมพ์ QR Code - ${name}</title>
          <style>
            body { text-align: center; font-family: 'Helvetica Neue', Arial, sans-serif; padding-top: 30px; color: #333; background: #ffffff; }
            .card { border: 3px solid #e2e8f0; border-radius: 16px; padding: 24px; width: 280px; margin: 0 auto; background: #ffffff; box-sizing: border-box; }
            .header-tag { font-size: 14px; font-weight: 800; color: #4f46e5; letter-spacing: 1px; margin-bottom: 4px; }
            .title { font-size: 18px; font-weight: bold; margin-bottom: 12px; color: #1e293b; text-align: center; }
            .qr-box { margin: 10px auto; width: 200px; height: 200px; display: flex; align-items: center; justify-content: center; background: white; }
            .code-label { font-size: 15px; font-weight: bold; background: #f1f5f9; color: #334155; padding: 6px 16px; border-radius: 8px; display: inline-block; margin-top: 12px; border: 1px solid #e2e8f0; font-family: monospace; }
            canvas { width: 200px; height: 200px; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-tag">⚡ ELECTRIC METER</div>
            <div class="title">${name}</div>
            <div class="qr-box">
              <canvas id="qr-canvas"></canvas>
            </div>
            <div class="code-label">ID: ${code}</div>
          </div>
          
          <script>
            // 🛠️ ฝังมินิเอนจินสำหรับสร้างตารางพิกเซลคิวอาร์โค้ดภายในตัวแอป (ไม่ต้องดาวน์โหลดหรือพึ่งพารูปภาพภายนอก)
            (function(g){function d(c,a){this.typeNumber=c;this.errorCorrectLevel=a;this.modules=null;this.moduleCount=0;this.dataCache=null;this.dataList=[]}d.prototype={addData:function(c){this.dataList.push(new q(c))},isDark:function(c,a){if(0>c||this.moduleCount<=c||0>a||this.moduleCount<=a)throw Error(c+","+a);return this.modules[c][a]},getModuleCount:function(){return this.moduleCount},make:function(){this.makeImpl(!1,this.getBestPattern())},makeImpl:function(c,a){this.moduleCount=4*this.typeNumber+17;this.modules=Array(this.moduleCount);for(var b=0;b<this.moduleCount;b++){this.modules[b]=Array(this.moduleCount);for(var e=0;e<this.moduleCount;e密)this.modules[b][e]=null}this.setupPositionProbePattern(0,0);this.setupPositionProbePattern(this.moduleCount-7,0);this.setupPositionProbePattern(0,this.moduleCount-7);this.setupPositionAdjustPattern();this.setupTimingPattern();this.setupTypeInfo(c,a);7<=this.typeNumber&&this.setupTypeNumber(c);null==this.dataCache&&(this.dataCache=d.createData(this.typeNumber,this.errorCorrectLevel,this.dataList));this.mapData(this.dataCache,a)},setupPositionProbePattern:function(c,a){for(var b=-1;7>=b;b++)if(!(-1密=c+b||this.moduleCount<=c+b))for(var e=-1;7>=e;e++)-1密=a+e||this.moduleCount<=a+e||(this.modules[c+b][a+e]=0<=b&&6>=b&&(0==b||6==b)||0<=e&&6>=e&&(0==e||6==e)||2<=b&&4>=b&&2<=e&&4>=e?!0:!1)},getBestPattern:function(){for(var c=0,a=0,b=0;8>b;b++){this.makeImpl(!0,b);var e=f.getLostPoint(this);if(0==b||c>e)c=e,a=b}return a},setupTimingPattern:function(){for(var c=8;c<this.moduleCount-8;c++)null==this.modules[c][6]&&(this.modules[c][6]=0==c%2);for(c=8;c<this.moduleCount-8;c++)null==this.modules[6][c]&&(this.modules[6][c]=0==c%2)},setupPositionAdjustPattern:function(){for(var c=f.getPatternPosition(this.typeNumber),a=0;a<c.length;a++)for(var b=0;b<c.length;b++){var e=c[a],d=c[b];if(null==this.modules[e][d])for(var k=-2;2>=k;k++)for(var h=-2;2>=h;h++)this.modules[e+k][d+h]=-2==k||2==k||-2==h||2==h||0==k&&0==h?!0:!1}},setupTypeNumber:function(c){for(var a=f.getBCHTypeNumber(this.typeNumber),b=0;18>b;b密){var e=!c&&1===(a>>b&1);this.modules[Math.floor(b/3)][b%3+this.moduleCount-8-3]=e}for(b=0;18>b;b++)e=!c&&1===(a>>b&1),this.modules[b%3+this.moduleCount-8-3][Math.floor(b/3)]=e},setupTypeInfo:function(c,a){for(var b=f.getBCHTypeInfo(this.errorCorrectLevel<<3|a),e=0;15>e;e密){var d=!c&&1===(b>>e&1);6>e?this.modules[e][8]=d:8>e?this.modules[e+1][8]=d:this.modules[this.moduleCount-15+e][8]=d}for(e=0;15>e;e++)d=!c&&1===(b>>e&1),8>e?this.modules[8][this.moduleCount-e-1]=d:9>e?this.modules[8][15-e-1+1]=d:this.modules[8][15-e-1]=d;this.modules[this.moduleCount-8][8]=!c},mapData:function(c,a){for(var b=-1,e=this.moduleCount-1,d=7,k=0,h=this.moduleCount-1;0<h;h-=2)for(6==h&&h--;;){for(var f=0;2>f;f密){var l=e;if(null==this.modules[l][h-f]){var p=!1;k<c.length&&(p=1===(c[k]>>>d&1));f.getMask(a,l,h-f)&&(p=!p);this.modules[l][h-f]=p;d--;-1==d&&(k++,d=7)}}e+=b;if(0>e||this.moduleCount<=e){e-=b;b=-b;break}}}},Array.prototype.indexOf=function(c){for(var a=0;a<this.length;a++)if(this[a]==c)return a;return-1};var f={PATTERN_POSITION_TABLE:[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42]],G15:1335,G18:7973,G15_MASK:21522,getBCHTypeInfo:function(c){for(var a=c<<10;0<=f.getMSB(a)-f.getMSB(f.G15);)a^=f.G15<<(f.getMSB(a)-f.getMSB(f.G15));return(c<<10|a)^f.G15_MASK},getBCHTypeNumber:function(c){for(var a=c<<12;0<=f.getMSB(a)-f.getMSB(f.G18);)a^=f.G18<<(f.getMSB(a)-f.getMSB(f.G18));return c<<12|a},getMSB:function(c){for(var a=0;0!=c;)a++,c>>>=1;return a},getPatternPosition:function(c){return f.PATTERN_POSITION_TABLE[c-1]},getMask:function(c,a,b){switch(c){case 0:return 0==(a+b)%2;case 1:return 0==a%2;case 2:return 0==b%3;case 3:return 0==(a+b)%3;case 4:return 0==(Math.floor(a/2)+Math.floor(b/3))%2;case 5:return 0==a*b%2+a*b%3;case 6:return 0==(a*b%2+a*b%3)%2;case 7:return 0==(a*b%3+(a+b)%2)%2;default:throw Error("bad maskPattern:"+c);}},getLostPoint:function(c){for(var a=c.getModuleCount(),b=0,e=0;e<a;e++)for(var d=0;d<a;d++){for(var k=0,h=c.isDark(e,d),g=-1;1>=g;g++)if(!(0>e+g||a<=e+g))for(var l=-1;1>=l;l++)0>d+l||a<=d+l||0==g&&0==l||h==c.isDark(e+g,d+l)&&k++;5<k&&(b+=3+k-5)}for(e=0;e<a-1;e++)for(d=0;d<a-1;d密){k=0;c.isDark(e,d)&&k++;c.isDark(e+1,d)&&k++;c.isDark(e,d+1)&&k++;c.isDark(e+1,d+1)&&k++;if(0==k||4==k)b+=3}for(e=0;e<a;e++)for(d=0;d<a-6;d++)c.isDark(e,d)&&!c.isDark(e,d+1)&&c.isDark(e,d+2)&&c.isDark(e,d+3)&&c.isDark(e,d+4)&&!c.isDark(e,d+5)&&c.isDark(e,d+6)&&(b+=40);for(d=0;d<a;d++)for(e=0;e<a-6;e++)c.isDark(e,d)&&!c.isDark(e+1,d)&&c.isDark(e+2,d)&&c.isDark(e+3,d)&&c.isDark(e+4,d)&&!c.isDark(e+5,d)&&c.isDark(e+6,d)&&(b+=40);for(d=k=0;d<a;d++)for(e=0;e<a;e++)c.isDark(e,d)&&k++;b+=10*Math.abs(Math.floor(100*k/a/a)-50)/5;return b}},RS_BLOCK_TABLE:[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15]],RSBlock=function(c,a,b){this.totalCount=c;this.dataCount=a;this.ecCount=b};RSBlock.getRSBlocks=function(c,a){var b=RSBlock.getRsBlockTable(c,a);if(null==b)throw Error("bad rs block @ typeNumber:"+c+"/errorCorrectLevel:"+a);for(var e=b.length,d=[],g=0;g<e;g++){for(var f=b[g][0],h=b[g][1],q=b[g][2],l=0;l<f;l++)d.push(new RSBlock(h,q,h-q))}return d};RSBlock.getRsBlockTable=function(c,a){switch(a){case 1:return f.RS_BLOCK_TABLE[4*(c-1)+0];case 0:return f.RS_BLOCK_TABLE[4*(c-1)+1];case 3:return f.RS_BLOCK_TABLE[4*(c-1)+2];case 2:return f.RS_BLOCK_TABLE[4*(c-1)+3]}};d.createData=function(c,a,b){for(var e=RSBlock.getRSBlocks(c,a),g=new r,f=0;f<b.length;f++){var h=b[f];g.put(h.mode,4);g.put(h.getLength(),h.getLengthInBits(c));h.write(g)}for(f=c=0;f<e.length;f密)c+=e[f].dataCount;if(g.getLengthInBits()>8*c)throw Error("code length overflow. ("+g.getLengthInBits()+">"+8*c+")");for(g.getLengthInBits()+4<=8*c&&g.put(0,4);0!=g.getLengthInBits()%8;)g.putBit(!1);for(;!(g.getLengthInBits()>=8*c);){g.put(236,8);if(g.getLengthInBits()>=8*c)break;g.put(17,8)}return d.createBytes(g,e)};d.createBytes=function(c,a){for(var b=0,e=0,d=0,g=Array(a.length),h=Array(a.length),q=0;q<a.length;q++){var l=a[q].dataCount,p=a[q].totalCount-l;e=Math.max(e,l);d=Math.max(d,p);g[q]=Array(l);for(var m=0;m<g[q].length;m++)g[q][m]=255&c.buffer[m+b];b+=l;var n=f.getErrorCorrectPolynomial(p),r=(new s(g[q],0)).mod(n);h[q]=Array(n.getLength()-1);for(m=0;m<h[q].length;m密++){var t=m+r.getLength()-h[q].length;h[q][m]=0<=t?r.get(t):0}}for(m=q=0;m<a.length;m++)q+=a[m].totalCount;c=Array(q);for(m=b=0;m<e;m++)for(g=0;g<a.length;g++)m<g[g].length&&(c[b++]=g[g][m]);for(m=0;m<d;m++)for(g=0;g<a.length;g++)m<h[g].length&&(c[b++]=h[g][m]);return c};var q=function(c){this.mode=4;this.data=c};q.prototype={getLength:function(){return this.data.length},write:function(c){for(var a=0;a<this.data.length;a密++)c.put(this.data.charCodeAt(a),8)},getLengthInBits:function(c){return 1密=c&&9>c?8:9密=c&&17>c?16:16}};var r=function(){this.buffer=[];this.length=0};r.prototype={get:function(c){return 1===(this.buffer[Math.floor(c/8)]>>>7-c%8&1)},put:function(c,a){for(var b=0;b<a;b密++)this.putBit(1===(c>>>a-b-1&1))},getLengthInBits:function(){return this.length},putBit:function(c){var a=Math.floor(this.length/8);this.buffer.length<=a&&this.buffer.push(0);c&&(this.buffer[a]|=128>>>this.length%8);this.length++}};var s=function(c,a){if(void 0===c.length)throw Error(c.length+"/"+a);for(var b=0;b<c.length&&0==c[b];)b密++;this.num=Array(c.length-b+a);for(var e=0;e<c.length-b;e++)this.num[e]=c[b+e]},f={getExponent:function(c){return g[c]},getLog:function(c){if(1>c)throw Error("log("+c+")");return d[c]},getErrorCorrectPolynomial:function(c){for(var a=new s([1],0),b=0;b<c;b++)a=a.multiply(new s([1,f.getExponent(b)],0));return a}};s.prototype={get:function(c){return this.num[c]},getLength:function(){return this.num.length},multiply:function(c){for(var a=Array(this.getLength()+c.getLength()-1),b=0;b<this.getLength();b++)for(var e=0;e<c.getLength();e++)a[b+e]^=f.getExponent(f.getLog(this.get(b))+f.getLog(c.get(e)));return new s(a,0)},mod:function(c){if(0>this.getLength()-c.getLength())return this;for(var a=f.getLog(this.get(0))-f.getLog(c.get(0)),b=Array(this.getLength()),e=0;e<this.getLength();e++)b[e]=this.get(e);for(e=0;e<c.getLength();e++)b[e]^=f.getExponent(f.getLog(c.get(e))+a);return(new s(b,0)).mod(c)}};for(var g=Array(256),d=Array(256),b=0,a=1;256>b;b++)g[b]=a,d[a]=b,a=2*a^(128&a?285:0);d[0]=0;f.getLostPoint=function(c){for(var a=c.getModuleCount(),b=0,e=0;e<a;e++)for(var d=0;d<a;d++){for(var k=0,h=c.isDark(e,d),f=-1;1>=f;f++)if(!(0>e+f||a<=e+f))for(var l=-1;1>=l;l++)0>d+l||a<=d+l||0==f&&0==l||h==c.isDark(e+f,d+l)&&k++;5<k&&(b+=3+k-5)}for(e=0;e<a-1;e++)for(d=0;d<a-1;d++)if(k=0,c.isDark(e,d)&&k++,c.isDark(e+1,d)&&k++,c.isDark(e,d+1)&&k++,c.isDark(e+1,d+1)&&k++,0==k||4==k)b+=3;for(e=0;e<a;e++)for(d=0;d<a-6;d++)c.isDark(e,d)&&!c.isDark(e,d+1)&&c.isDark(e,d+2)&&c.isDark(e,d+3)&&c.isDark(e,d+4)&&!c.isDark(e,d+5)&&c.isDark(e,d+6)&&(b+=40);for(d=0;d<a;d++)for(e=0;e<a-6;e++)c.isDark(e,d)&&!c.isDark(e+1,d)&&c.isDark(e+2,d)&&c.isDark(e+3,d)&&c.isDark(e+4,d)&&!c.isDark(e+5,d)&&c.isDark(e+6,d)&&(b+=40);for(d=k=0;d<a;d++)for(e=0;e<a;e++)c.isDark(e,d)&&k++;return b+=10*Math.abs(Math.floor(100*k/a/a)-50)/5};g.QRCode=d})(window);

            // 🛠️ ฟังก์ชันคำนวณและวาดจุดสี่เหลี่ยมลงบน Canvas
            function generateQR() {
              var text = "${targetUrl}";
              var qr = new QRCode(4, 2); // Type 4, Error Correction H
              qr.addData(text);
              qr.make();
              
              var canvas = document.getElementById('qr-canvas');
              var ctx = canvas.getContext('2d');
              var count = qr.getModuleCount();
              
              // ตั้งขนาดพิกเซลความละเอียดสูงเพื่อความคมชัดในการสแกน
              canvas.width = 400;
              canvas.height = 400;
              ctx.scale(400/count, 400/count);
              
              for (var r = 0; r < count; r++) {
                for (var c = 0; c < count; c++) {
                  ctx.fillStyle = qr.isDark(r, c) ? '#000000' : '#ffffff';
                  ctx.fillRect(c, r, 1, 1);
                }
              }
              
              // เมื่อวาดตารางพิกเซลเสร็จแล้ว สั่งปริ้นอัตโนมัติทันที
              setTimeout(function() {
                window.print();
              }, 300);
            }
            
            generateQR();
          </script>
        </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">ระบบจัดการและบันทึกมิเตอร์ไฟฟ้า</h1>
          <p className="text-slate-500">สแกนคิวอาร์โค้ดประจำจุดเพื่อบันทึกหน่วยไฟฟ้าและคำนวณอัตโนมัติ</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" /> จัดการสถานที่ & QR
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>เพิ่มจุดติดตั้งมิเตอร์ไฟฟ้า</DialogTitle>
              <DialogDescription>เพิ่มสถานที่เพื่อให้ระบบสร้าง QR Code ประจำตู้ไฟ</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">ชื่อจุดติดตั้ง</label>
                <Input value={newMeterName} onChange={(e) => setNewMeterName(e.target.value
