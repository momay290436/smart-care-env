return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* คอลัมน์ซ้าย: บันทึกข้อมูล */}
        <Card className="lg:col-span-1 border-t-4 border-t-indigo-600">
          <CardHeader><CardTitle>บันทึกข้อมูล</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-700">ชื่อผู้บันทึก</label>
              <Input disabled value={userName} className="bg-indigo-50 font-semibold" />
            </div>

            {/* ส่วนกล้อง: จำกัดความสูงและจัดวางไม่ให้ทับคนอื่น */}
            <div className="space-y-2">
              {!isScanning ? (
                <Button onClick={startScanner} className="w-full"><Camera className="mr-2"/> สแกน QR Code</Button>
              ) : (
                <div className="relative border-2 border-indigo-200 rounded-lg overflow-hidden">
                  <div id="reader" className="w-full h-auto min-h-[300px]"></div>
                  <Button onClick={() => window.location.reload()} className="absolute top-2 right-2" size="sm" variant="destructive"><X className="w-4 h-4"/></Button>
                </div>
              )}
            </div>
            
            <Input type="number" placeholder="เลขมิเตอร์ปัจจุบัน" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            <Button onClick={() => createLogMutation.mutate()} className="w-full">บันทึกข้อมูล</Button>
          </CardContent>
        </Card>

        {/* คอลัมน์ขวา: ประวัติ (แยกฝั่งชัดเจน) */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>ประวัติการบันทึก</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>วันเวลา</TableHead>
                  <TableHead>ผู้บันทึก</TableHead>
                  <TableHead>เลขมิเตอร์</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell>{new Date(log.created_at).toLocaleDateString('th-TH')}</TableCell>
                    <TableCell>{log.recorded_by_name}</TableCell>
                    <TableCell>{log.current_value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
