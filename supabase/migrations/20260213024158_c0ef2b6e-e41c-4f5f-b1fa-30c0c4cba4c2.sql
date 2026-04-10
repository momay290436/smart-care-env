
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
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

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
  waste_type TEXT NOT NULL CHECK (waste_type IN ('general', 'infectious', 'hazardous')),
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
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create app_settings table
CREATE TABLE public.app_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_5s ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_extinguisher_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

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

-- RLS Policies

-- departments: all authenticated can read
CREATE POLICY "Anyone can read departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- profiles: read own or same dept, admin reads all
CREATE POLICY "Users can read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR auth_id = auth.uid() OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (auth_id = auth.uid());

-- user_roles: admin can manage, users can read own
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage roles" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- maintenance_tickets
CREATE POLICY "Read tickets" ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Create tickets" ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update tickets" ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Delete tickets" ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- audit_5s
CREATE POLICY "Read audits" ON public.audit_5s FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Create audits" ON public.audit_5s FOR INSERT TO authenticated
  WITH CHECK (auditor_id = auth.uid());
CREATE POLICY "Update audits" ON public.audit_5s FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Delete audits" ON public.audit_5s FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- waste_logs
CREATE POLICY "Read waste logs" ON public.waste_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Create waste logs" ON public.waste_logs FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Update waste logs" ON public.waste_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Delete waste logs" ON public.waste_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- fire_extinguisher_checks
CREATE POLICY "Read fire checks" ON public.fire_extinguisher_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Create fire checks" ON public.fire_extinguisher_checks FOR INSERT TO authenticated
  WITH CHECK (checked_by = auth.uid());
CREATE POLICY "Update fire checks" ON public.fire_extinguisher_checks FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR department_id = public.get_user_department_id(auth.uid()));
CREATE POLICY "Delete fire checks" ON public.fire_extinguisher_checks FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- app_settings: admin only
CREATE POLICY "Admin can read settings" ON public.app_settings FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin can manage settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

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
  ('อายุรกรรม'),
  ('ศัลยกรรม'),
  ('สูติ-นรีเวช'),
  ('กุมารเวชกรรม'),
  ('ออร์โธปิดิกส์'),
  ('ห้องฉุกเฉิน'),
  ('ห้องผ่าตัด'),
  ('ห้องคลอด'),
  ('ผู้ป่วยนอก (OPD)'),
  ('เภสัชกรรม'),
  ('รังสีวิทยา'),
  ('เวชศาสตร์ฟื้นฟู'),
  ('โภชนาการ'),
  ('ซักฟอก'),
  ('งานบริหารทั่วไป');

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_maintenance_tickets_updated_at
  BEFORE UPDATE ON public.maintenance_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
