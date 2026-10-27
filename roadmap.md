# Roadmap

## เสร็จแล้ว (27 ต.ค. 2026)
- [x] Card เวรเจ้าหน้าที่วันนี้ (33.3% แถวเดียวกับสถานะน้ำสำรอง/ฉุกเฉิน) ใน WaterManagement.tsx
- [x] แก้ build error setEditMeterForm ขาด usage_details (line 560)
- [x] ยืนยันฟอร์มกรอกมิเตอร์เครื่องสูบเลื่อนได้ (max-h-[90dvh] + overflow อยู่แล้วใน PumpMeters.tsx)
- [x] ยืนยันข้อมูล duty_assignments + duty_staff พร้อม join full_name/phone

## ค้าง / รอ
- [ ] ทดสอบ QR flow + ฟีเจอร์ใหม่กับบัญชีจริง (blocker: mint session ไม่สำเร็จ — ต้องให้ผู้ใช้ล็อกอินผ่านพรีวิวแล้ว inject session)
- [ ] ยืนยัน seed GEN001 ใน generator_machines
- [ ] รอคำตอบผู้ใช้: ต้องการให้สิทธิ์ระดับปุ่ม (action keys ในแท็บสิทธิ์) บล็อก/ซ่อนปุ่มจริงหรือไม่ — ปัจจุบันเป็นแค่การติ๊กเก็บ
