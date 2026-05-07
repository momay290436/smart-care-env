
# แผนการดำเนินงาน 9 รายการ

## 1. แก้ไขปัญหากำหนดสิทธิ์ (ON CONFLICT error)
- ตาราง `user_roles` มี unique constraint บน `(user_id, role)` ไม่ใช่ `user_id` เพียงอย่างเดียว
- แก้ไข `PagePermissionsTab.tsx` ให้ลบ role เดิมก่อนแล้ว insert ใหม่ แทนการใช้ upsert

## 2. ปุ่ม แก้ไข/ลบ สำหรับ Admin ในทุกหน้าบันทึกข้อมูล
- เพิ่มปุ่มเล็กๆ ท้ายแถวข้อมูลในหน้า WaterMeter, WasteLog, EnvRound, FireCheck, Audit5S
- แสดงเฉพาะเมื่อผู้ใช้เป็น Admin

## 3. QR ถังดับเพลิง - ดาวน์โหลดหลายรายการ + เพิ่มสีบอร์น
- เพิ่ม checkbox สำหรับเลือกหลายรายการ และปุ่มดาวน์โหลด QR ทั้งหมด
- เพิ่มตัวเลือกสี "บอร์น" (bronze) ใน dropdown สีถัง

## 4. แก้ไขการสร้างผู้ใช้จากแอป
- ตรวจสอบ edge function `create-user` ให้ทำงานได้ถูกต้อง

## 5. มิเตอร์น้ำ - Admin เลือกวันที่/เวลา/ผู้บันทึก
- ปรับ UI ให้ calendar, time input, และ recorder name เป็นช่องกรอกที่ใช้งานได้จริง

## 6-9. ปรับปรุงหน้าจัดการปัญหา (Issue Management)
- เพิ่ม Text Area สำหรับ "วิธีการจัดการ"
- แสดงรูปภาพความผิดปกติ
- เพิ่ม Filter แผนก
- Badge แจ้งเตือนจำนวนปัญหาค้างบนหน้าหลัก
- Auto-create issue เมื่อบันทึกผลว่า "ผิดปกติ"
- อัพเดตสถานะกลับไปหน้าต้นทางเมื่อ "เสร็จสิ้น"

## Technical Details
- Migration: เพิ่ม unique constraint `user_id` บน `user_roles` หรือแก้ logic ฝั่ง client
- แก้ไขไฟล์: PagePermissionsTab.tsx, WaterMeter.tsx, IssueManagement.tsx, HomePage.tsx, AdminPage.tsx, FireCheck.tsx, WasteLog.tsx, EnvRound.tsx, Audit5S.tsx
