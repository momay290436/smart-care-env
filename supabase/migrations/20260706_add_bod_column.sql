-- Add missing columns to wastewater_inspection_logs for BOD and sediment tracking
ALTER TABLE public.wastewater_inspection_logs
  ADD COLUMN IF NOT EXISTS sediment_volume numeric COMMENT 'ปริมาณตะกอน (SV30) มม./ล',
  ADD COLUMN IF NOT EXISTS sedimentation_char text COMMENT 'ลักษณะการตกตะกอน',
  ADD COLUMN IF NOT EXISTS bod_value numeric COMMENT 'BOD (Biochemical Oxygen Demand) mg/l';
