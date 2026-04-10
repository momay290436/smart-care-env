
-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  auth_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  department_id UUID REFERENCES public.departments(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'user', 'technician', 'manager');

CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  UNIQUE(user_id, role)
);

-- Create maintenance_tickets table
CREATE TABLE public.maintenance_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'urgent', 'critical')),
  photo_url TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create audit_5s table
CREATE TABLE public.audit_5s (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  score_json JSONB NOT NULL DEFAULT '{}',
  photo_before TEXT,
  photo_after TEXT,
  total_score NUMERIC NOT NULL DEFAULT 0,
  auditor_id UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create waste_logs table
CREATE TABLE public.waste_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type TEXT NOT NULL CHECK (waste_type IN ('general', 'infectious', 'hazardous', 'recycle')),
  weight NUMERIC NOT NULL DEFAULT 0,
  department_id UUID REFERENCES public.departments(id),
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create fire_extinguisher_checks table
CREATE TABLE public.fire_extinguisher_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  location TEXT NOT NULL,
  pressure_ok BOOLEAN NOT NULL DEFAULT false,
  condition_ok BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  department_id UUID REFERENCES public.departments(id),
  checked_by UUID NOT NULL REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  inspection_details jsonb DEFAULT '{}'::jsonb,
  inspector_name text
);

-- Create fire_extinguisher_locations table
CREATE TABLE public.fire_extinguisher_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  building text,
  floor text,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Equipment categories table
CREATE TABLE public.equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Equipment table
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.equipment_categories(id),
  department_id uuid REFERENCES public.departments(id),
  status text NOT NULL DEFAULT 'active',
  qr_code_url text,
  qr_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Technicians table
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  line_user_id text,
  category_id uuid REFERENCES public.equipment_categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Repair tickets table
CREATE TABLE public.repair_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  photo_url text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  assigned_technician_id uuid REFERENCES public.technicians(id),
  accepted_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_5s ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_extinguisher_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_extinguisher_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

-- Helper function: has_role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper function: get_user_department_id
CREATE OR REPLACE FUNCTION public.get_user_department_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.profiles
  WHERE auth_id = _user_id
  LIMIT 1
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (auth_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_maintenance_tickets_updated_at
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Equipment QR URL trigger
CREATE OR REPLACE FUNCTION public.generate_equipment_qr_url()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.qr_code_url := 'https://lovable.dev/qr/' || NEW.code;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_equipment_qr_url BEFORE INSERT OR UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.generate_equipment_qr_url();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_repair_tickets_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies: departments
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT USING (true);
CREATE POLICY "Admin can manage departments" ON public.departments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: profiles
CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR auth_id = auth.uid() OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

-- RLS Policies: user_roles
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: maintenance_tickets
CREATE POLICY "Read tickets" ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Create tickets" ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update tickets" ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Delete tickets" ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: audit_5s
CREATE POLICY "Read audits" ON public.audit_5s FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Create audits" ON public.audit_5s FOR INSERT TO authenticated
  WITH CHECK (auditor_id = auth.uid());
CREATE POLICY "Update audits" ON public.audit_5s FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Delete audits" ON public.audit_5s FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: waste_logs
CREATE POLICY "Read waste logs" ON public.waste_logs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Create waste logs" ON public.waste_logs FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Update waste logs" ON public.waste_logs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Delete waste logs" ON public.waste_logs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: fire_extinguisher_checks
CREATE POLICY "Read fire checks" ON public.fire_extinguisher_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Public can read fire checks" ON public.fire_extinguisher_checks FOR SELECT USING (true);
CREATE POLICY "Create fire checks" ON public.fire_extinguisher_checks FOR INSERT TO authenticated
  WITH CHECK (checked_by = auth.uid());
CREATE POLICY "Update fire checks" ON public.fire_extinguisher_checks FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR department_id = get_user_department_id(auth.uid()));
CREATE POLICY "Delete fire checks" ON public.fire_extinguisher_checks FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: fire_extinguisher_locations
CREATE POLICY "Anyone can read locations" ON public.fire_extinguisher_locations FOR SELECT USING (true);
CREATE POLICY "Admin can manage locations" ON public.fire_extinguisher_locations FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: app_settings
CREATE POLICY "Admin can read settings" ON public.app_settings FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage settings" ON public.app_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: equipment_categories
CREATE POLICY "Anyone can read categories" ON public.equipment_categories FOR SELECT USING (true);
CREATE POLICY "Admin can manage categories" ON public.equipment_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: equipment
CREATE POLICY "Anyone can read equipment" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Admin can manage equipment" ON public.equipment FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: technicians
CREATE POLICY "Anyone can read technicians" ON public.technicians FOR SELECT USING (true);
CREATE POLICY "Admin can manage technicians" ON public.technicians FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies: repair_tickets
CREATE POLICY "Users can create repair tickets" ON public.repair_tickets FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can read repair tickets" ON public.repair_tickets FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR created_by = auth.uid()
);
CREATE POLICY "Technicians and admins can update repair tickets" ON public.repair_tickets FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)
);
CREATE POLICY "Admin can delete repair tickets" ON public.repair_tickets FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for photos
INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true);

-- Storage policies
CREATE POLICY "Authenticated users can upload photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos');
CREATE POLICY "Anyone can view photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photos');
CREATE POLICY "Users can delete own photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos');

-- Insert default departments
INSERT INTO public.departments (name) VALUES 
  ('อายุรกรรม'), ('ศัลยกรรม'), ('สูติ-นรีเวช'), ('กุมารเวชกรรม'), ('ออร์โธปิดิกส์'),
  ('ห้องฉุกเฉิน'), ('ห้องผ่าตัด'), ('ห้องคลอด'), ('ผู้ป่วยนอก (OPD)'), ('เภสัชกรรม'),
  ('รังสีวิทยา'), ('เวชศาสตร์ฟื้นฟู'), ('โภชนาการ'), ('ซักฟอก'), ('งานบริหารทั่วไป');

-- Insert default fire extinguisher locations
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

-- Performance indexes
CREATE INDEX idx_audit_5s_created_at ON public.audit_5s(created_at DESC);
CREATE INDEX idx_audit_5s_department_id ON public.audit_5s(department_id);
CREATE INDEX idx_fire_checks_checked_at ON public.fire_extinguisher_checks(checked_at DESC);
CREATE INDEX idx_maintenance_tickets_created_at ON public.maintenance_tickets(created_at DESC);
CREATE INDEX idx_waste_logs_created_at ON public.waste_logs(created_at DESC);
CREATE INDEX idx_repair_tickets_created_at ON public.repair_tickets(created_at DESC);
CREATE INDEX idx_repair_tickets_status ON public.repair_tickets(status);
CREATE INDEX idx_profiles_auth_id ON public.profiles(auth_id);
