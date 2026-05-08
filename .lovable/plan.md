
# แผนการแก้ไข

## 1. แก้ไขประวัติการตรวจไม่แสดง (FireCheck, 5S, ENV Round)
- ตรวจสอบ query ที่ดึงข้อมูลและแก้ไขให้แสดงรายการตรวจทั้งหมด
- เพิ่ม limit จาก 30 → 200 และแก้ filter logic

## 2. ระบบบันทึกผลตรวจคุณภาพน้ำแบบใหม่ (Batch Testing)
- สร้างตาราง `water_quality_batches` เก็บข้อมูลชุดการตรวจ (report_period, water_type, test_date)
- สร้างตาราง `water_quality_batch_items` เก็บผลแต่ละรายการตรวจ (parameter_name, test_result, standard_value, unit)
- ออกแบบฟอร์มบันทึกใหม่ที่รวมทุกรายการตรวจ พร้อมเลือกประเภทน้ำและรอบการตรวจ
- แสดงประวัติพร้อมเลือกช่วงเวลา
- Export Excel 3 Sheets (น้ำทิ้ง, ประปา, กากตะกอน) ตามรูปแบบไฟล์ตัวอย่าง โดยใช้ exceljs

## 3. Admin edit สำหรับประวัติการบันทึก
- เพิ่มปุ่มแก้ไขใน water meter, pathogen, water quality history
- เปิด dialog แก้ไขข้อมูลได้

## 4. แก้ไข Excel Export มิเตอร์น้ำ
- คำนวณ daily total ให้ถูกต้องทุกวัน (ไม่ใช่แค่วันที่มี daily_total ใน DB)

## รายละเอียดทางเทคนิค
- Migration: สร้าง 2 ตาราง water_quality_batches, water_quality_batch_items พร้อม RLS
- แก้ไขไฟล์: FireCheck.tsx, Audit5S.tsx, EnvRound.tsx, WaterMeter.tsx, WaterManagement.tsx (หรือ component ที่เกี่ยวข้อง)
- ติดตั้ง exceljs สำหรับ export ที่ซับซ้อน
- สร้าง component ใหม่: WaterQualityBatchForm.tsx
