return (
    // 📱 เปลี่ยน Container หลักให้รองรับขนาดหน้าจอเคลื่อนที่ได้อย่างสมบูรณ์ ไม่ล้นออกขอบข้าง
    <div className="w-full max-w-full md:max-w-[100vw] px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 bg-slate-50/50 min-h-screen box-border overflow-x-hidden">
      
      {/* ส่วนหัวของระบบหน้าเว็บ (ปรับปุ่มเพิ่มสถานที่และดาวน์โหลดรายงานให้สมดุลบนจอมือถือ) */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-3 bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">ระบบบริหารจัดการมิเตอร์</h1>
          <p className="text-xs text-slate-500 mt-0.5">บันทึก ติดตาม และคัดแยกรายงานสถิติการใช้งานไฟฟ้าและน้ำประปา</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:flex gap-2">
          <Button onClick={exportExcel} variant="outline" className="w-full sm:w-auto text-xs sm:text-sm h-10 border-slate-200 text-slate-700 font-medium order-2 sm:order-1">
            <FileSpreadsheet className="mr-2 h-4 w-4 text-emerald-600"/> Export แยกหมวดหมู่
          </Button>
          <Dialog onOpenChange={(open) => { if(!open) { setGeneratedQrUrl(''); setNewMeter({name:'', code:'', serial:'', qr_url:''}); } }}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto text-xs sm:text-sm h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm order-1 sm:order-2">
                <Plus className="mr-2 h-4 w-4" /> เพิ่มสถานที่ติดตั้ง
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-[425px] rounded-2xl p-4 sm:p-6">
              <DialogHeader><DialogTitle className="text-base sm:text-lg">เพิ่มจุดติดตั้งและทำ QR Code</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                {!generatedQrUrl ? (
                  <>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">ชื่อสถานที่ (ใส่วงเล็บท้ายชื่อ เช่น สมชาย(ร้านค้า))</label>
                      <Input placeholder="เช่น สมชาย(ร้านค้า) หรือ อาคารA(แฟลต1)" value={newMeter.name} onChange={(e) => setNewMeter({...newMeter, name: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">หมายเลขเครื่องมิเตอร์</label>
                      <Input placeholder="กรอกรหัสเลขเครื่อง" value={newMeter.serial} onChange={(e) => setNewMeter({...newMeter, serial: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 font-medium mb-1 block">รหัสภายใน (ถ้ามี)</label>
                      <Input placeholder="เช่น ele-001" value={newMeter.code} onChange={(e) => setNewMeter({...newMeter, code: e.target.value})} className="h-9 text-sm" />
                    </div>
                    <Button className="w-full bg-indigo-600 text-white hover:bg-indigo-700 mt-2 h-10 text-sm" onClick={handleSaveMeter}>บันทึกและสร้างคิวอาร์</Button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-2 space-y-4 text-center">
                    <span className="text-xs sm:text-sm font-semibold text-emerald-600">ระบบสร้างคิวอาร์สำเร็จ</span>
                    <div className="border p-2 bg-white rounded-lg shadow-sm">
                      <img src={generatedQrUrl} alt="Generated QR" className="w-40 h-40 object-contain" />
                    </div>
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center h-10 text-sm" onClick={downloadQrCode}>
                      <Download className="mr-2 h-4 w-4" /> ดาวน์โหลดคิวอาร์ (.png)
                    </Button>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ส่วนแสดงสรุปยอดสถิติประจำเดือน (ปรับขนาดกล่องและฟอนต์ลดการบีบอัดบนจอมือถือ) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
        <Card className="border-l-4 border-l-amber-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้ไฟฟ้าประจำเดือน</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">{currentMonthStats.electric} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[10px] sm:text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600"><Zap className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm rounded-xl bg-white border border-slate-100">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-0.5">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ยอดรวมใช้น้ำประปา (ร้านค้า)</p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800">{currentMonthStats.water} <span className="text-xs font-normal text-slate-500">หน่วย</span></h3>
              <p className="text-[10px] sm:text-[11px] text-blue-600 font-medium flex items-center gap-1 mt-0.5"><TrendingUp className="h-3 w-3"/> รอบบิล: {currentMonthStats.monthName}</p>
            </div>
            <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600"><Droplet className="h-5 w-5" /></div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-indigo-500 shadow-sm rounded-xl bg-white border border-slate-100 sm:col-span-2 lg:col-span-1">
          <CardContent className="p-4 sm:p-5 flex items-center justify-between">
            <div className="space-y-1 w-full">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">ตัวกรองเลือกช่วงวันที่เรียกดู</p>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="relative">
                  <span className="absolute left-2 top-2.5 text-[9px] font-bold text-slate-400 uppercase">จาก</span>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-8 pr-1 text-xs h-8 font-medium text-slate-700 bg-slate-50 border-slate-200" />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-2.5 text-[9px] font-bold text-slate-400 uppercase">ถึง</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-8 pr-1 text-xs h-8 font-medium text-slate-700 bg-slate-50 border-slate-200" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 🚀 สลับตำแหน่งด้วย flex-col-reverse: บนจอมือถือ "ฟอร์มลงบันทึก" จะเด้งขึ้นไปอยู่ข้างบนสุดตัวแรก ส่วนตารางประวัติย้ายลงด้านล่าง */}
      <div className="flex flex-col-reverse lg:grid lg:grid-cols-4 gap-4 sm:gap-6 items-start">
        
        {/* คาร์ดตารางประวัติข้อมูล (อยู่ด้านล่างสุดเมื่อเปิดดูในมือถือ) */}
        <Card className="w-full lg:col-span-3 shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-3 px-4 sm:px-5 flex flex-row items-center justify-between">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-700">ประวัติจัดเก็บในระบบ ({filteredLogs.length} รายการ)</CardTitle>
            {(startDate || endDate) && (
              <Button size="sm" variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); }} className="text-[11px] text-rose-600 hover:bg-rose-50 h-7 px-2">ล้างวันที่</Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="w-full overflow-x-auto scrollbar-none sm:scrollbar-thin">
              <Table>
                <TableHeader className="bg-slate-50/70">
                  <TableRow className="hover:bg-transparent border-b border-slate-100">
                    <TableHead className="text-slate-600 font-bold text-[11px] py-3 pl-3 sm:pl-5 min-w-[110px] sm:min-w-[150px]">วัน/เดือนปี</TableHead>
                    <TableHead className="text-slate-600 font-bold text-[11px] py-3 min-w-[125px] sm:min-w-[180px]">จุดมิเตอร์</TableHead>
                    <TableHead className="text-slate-600 font-bold text-[11px] py-3 text-right min-w-[85px] sm:min-w-[130px]">เลขไฟ</TableHead>
                    <TableHead className="text-slate-600 font-bold text-[11px] py-3 text-right min-w-[85px] sm:min-w-[130px]">เลขน้ำ</TableHead>
                    <TableHead className="text-slate-600 font-bold text-[11px] py-3 text-right pr-3 sm:pr-5 min-w-[110px] sm:min-w-[160px]">ใช้ไฟรวม</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-slate-400 py-10 text-xs font-medium">ไม่พบข้อมูลประวัติ</TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log: any) => (
                      <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors border-b border-slate-100/70">
                        <TableCell className="text-slate-500 font-medium text-[11px] pl-3 sm:pl-5 py-3">
                          {/* บีบอัดรูปแบบวันเวลาบนมือถือให้สั้นลงโดยตัดวินาทีออกเพื่อความกระชับ */}
                          {new Date(log.created_at).toLocaleDateString('th-TH', {day:'numeric', month:'short'})} {new Date(log.created_at).toLocaleTimeString('th-TH', {hour: '2-digit', minute:'2-digit'})}
                        </TableCell>
                        <TableCell className="font-bold text-slate-700 text-[11px] py-3">{log.electricity_meters?.meter_name || 'ไม่ระบุ'}</TableCell>
                        <TableCell className="text-right text-slate-600 font-semibold text-[11px] py-3">{log.current_value.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-blue-600 font-bold text-[11px] py-3">
                          {log.current_water_value ? log.current_water_value.toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right pr-3 sm:pr-5 py-3">
                          <span className="inline-flex items-center justify-center px-1.5 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-50 text-emerald-700 font-black text-[10px] sm:text-xs rounded-lg border border-emerald-100">
                            +{log.units_used ?? 0}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 🌟 คาร์ดปุ่มสแกนคิวอาร์และฟอร์มลงบันทึก (แสดงเป็นลำดับแรกสุดด้านบนเมื่อเปิดใช้งานบนสมาร์ทโฟน) */}
        <Card className="w-full lg:col-span-1 shadow-sm border border-slate-200/80 bg-white rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50 border-b border-slate-100 py-2.5 px-4">
            <CardTitle className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-500"/>ลงบันทึกค่างวดมิเตอร์</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 pt-3 px-4 pb-4">
            {!isScanning ? (
              <Button onClick={startScanner} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-4 sm:py-5 rounded-xl text-xs sm:text-sm font-bold shadow-sm active:scale-[0.98] transition-all">
                <Camera className="mr-2 h-4 w-4"/> เปิดกล้องสแกนคิวอาร์
              </Button>
            ) : (
              <div className="relative h-[200px] sm:h-[240px] border-4 border-indigo-500 rounded-xl overflow-hidden shadow-inner bg-black">
                <div id="reader" className="w-full h-full"></div>
                <Button onClick={() => window.location.reload()} className="absolute top-2 right-2 rounded-full h-7 w-7 p-0" size="sm" variant="destructive"><X className="h-3 w-3"/></Button>
              </div>
            )}
            <div className="space-y-0.5">
              <label className="text-[10px] font-semibold text-slate-500">สถานที่ปฏิบัติงานที่ตรวจจับได้</label>
              <Input value={meterDisplayName} placeholder="ชื่อสถานที่จากการสแกน" readOnly className="bg-slate-50 text-center font-bold text-slate-800 border-slate-200 text-xs sm:text-sm h-9" />
            </div>

            <div className="space-y-0.5">
              <label className="text-[10px] font-semibold text-amber-600 flex items-center gap-1"><Zap className="h-3 w-3"/> เลขมิเตอร์ไฟฟ้าปัจจุบัน</label>
              <Input type="number" value={currentValue} placeholder="ระบุตัวเลขไฟฟ้าล่าสุด" onChange={(e) => setCurrentValue(e.target.value)} className="text-center text-sm sm:text-base font-bold border-slate-300 focus:ring-2 focus:ring-indigo-500 h-9 sm:h-10" />
            </div>

            {isShop && (
              <div className="space-y-0.5 p-2.5 bg-blue-50/70 border border-blue-100 rounded-xl">
                <label className="text-[10px] font-bold text-blue-600 flex items-center gap-1"><Droplet className="h-3 w-3"/> เลขมิเตอร์น้ำปัจจุบัน (เฉพาะร้านค้า)</label>
                <Input type="number" value={currentWaterValue} placeholder="กรอกเลขมิเตอร์น้ำล่าสุด" onChange={(e) => setCurrentWaterValue(e.target.value)} className="text-center text-sm sm:text-base font-bold border-blue-300 bg-white focus:ring-2 focus:ring-blue-500 text-blue-700 h-9" />
              </div>
            )}

            <Button onClick={handleSave} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-4 sm:py-5 rounded-xl text-xs sm:text-sm shadow-sm active:scale-[0.98] transition-all">ยืนยันและบันทึกข้อมูล</Button>
          </CardContent>
        </Card>

      </div>
    </div>
  );
