
-- Fix departments RLS: current policies are RESTRICTIVE which blocks reads for non-admin users
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Admin can manage departments" ON public.departments;
DROP POLICY IF EXISTS "Anyone can read departments" ON public.departments;

-- Re-create as PERMISSIVE policies
CREATE POLICY "Anyone can read departments"
ON public.departments
FOR SELECT
USING (true);

CREATE POLICY "Admin can manage departments"
ON public.departments
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Also create a table for fire extinguisher locations (for searchable dropdown)
CREATE TABLE IF NOT EXISTS public.fire_extinguisher_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  building text,
  floor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fire_extinguisher_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read locations"
ON public.fire_extinguisher_locations
FOR SELECT
USING (true);

CREATE POLICY "Admin can manage locations"
ON public.fire_extinguisher_locations
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Insert default fire extinguisher locations based on hospital buildings
INSERT INTO public.fire_extinguisher_locations (name, building, floor) VALUES
('อาคารยานพาหนะ', 'อาคารยานพาหนะ', 'ชั้น 1'),
('อาคารซักฟอกจ่ายกลาง', 'อาคารซักฟอกจ่ายกลาง', 'ชั้น 1'),
('อาคารโภชนาการ', 'อาคารโภชนาการ', 'ชั้น 1'),
('อาคารมินิธัญญารักษ์', 'อาคารมินิธัญญารักษ์', 'ชั้น 1'),
('อาคารชันสูตร', 'อาคารชันสูตร', 'ชั้น 1'),
('อาคารผู้ป่วยนอก-ใน (OPD)', 'อาคารผู้ป่วยนอก-ใน', 'ชั้น 1'),
('อาคารผู้ป่วยนอก-ใน (OPD) ชั้น 2', 'อาคารผู้ป่วยนอก-ใน', 'ชั้น 2'),
('อาคารผู้ป่วยใน-ชาย', 'อาคารผู้ป่วยใน-ชาย', 'ชั้น 1'),
('อาคารซ่อมบำรุง', 'อาคารซ่อมบำรุง', 'ชั้น 1'),
('อาคารคลังยา', 'อาคารคลังยา', 'ชั้น 1'),
('อาคารสิ่งแวดล้อม', 'อาคารสิ่งแวดล้อม', 'ชั้น 1'),
('อาคารพัสดุ', 'อาคารพัสดุ', 'ชั้น 1'),
('อาคารทันตกรรม', 'อาคารทันตกรรม', 'ชั้น 1'),
('อาคารผู้ป่วยใน-หญิง', 'อาคารผู้ป่วยใน-หญิง', 'ชั้น 1'),
('อาคารเอกซเรย์ (X-ray)', 'อาคารเอกซเรย์', 'ชั้น 1'),
('อาคารอำนวยการ', 'อาคารอำนวยการ', 'ชั้น 1'),
('อาคารอำนวยการ ชั้น 2', 'อาคารอำนวยการ', 'ชั้น 2'),
('อาคารปฐมภูมิ,กายภาพบำบัด', 'อาคารปฐมภูมิ', 'ชั้น 1'),
('อาคารงานประกันสุขภาพ', 'อาคารงานประกันสุขภาพ', 'ชั้น 1'),
('อาคารจิตเวชและยาเสพติด', 'อาคารจิตเวชและยาเสพติด', 'ชั้น 1'),
('อาคารแพทย์แผนไทย', 'อาคารแพทย์แผนไทย', 'ชั้น 1'),
('อาคารศรีศิริกฤษณจินทร์', 'อาคารศรีศิริกฤษณจินทร์', 'ชั้น 1'),
('อาคารศรีศิริกฤษณจินทร์ ชั้น 2', 'อาคารศรีศิริกฤษณจินทร์', 'ชั้น 2'),
('ห้องประชุมเอื้องคำ', 'ห้องประชุมเอื้องคำ', 'ชั้น 1'),
('ห้องประชุมเอื้องหลวง', 'ห้องประชุมเอื้องหลวง', 'ชั้น 1'),
('ER', 'อาคารผู้ป่วยนอก-ใน', 'ชั้น 1');
