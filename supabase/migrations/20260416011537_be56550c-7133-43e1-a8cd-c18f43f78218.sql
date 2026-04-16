
-- Water Pathogen Monitoring
CREATE TABLE public.water_pathogen_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sample_point text NOT NULL,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_time time NOT NULL DEFAULT CURRENT_TIME,
  inspector_id uuid NOT NULL,
  inspector_name text NOT NULL DEFAULT '',
  chlorine_value numeric,
  total_coliform text NOT NULL DEFAULT 'not_found',
  e_coli text NOT NULL DEFAULT 'not_found',
  photo_url text,
  notes text,
  status text NOT NULL DEFAULT 'pass',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_pathogen_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage pathogen" ON public.water_pathogen_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read pathogen" ON public.water_pathogen_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert pathogen" ON public.water_pathogen_logs FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());

-- Water Assets
CREATE TABLE public.water_assets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  serial_no text,
  install_date date,
  lifespan_years integer,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage water assets" ON public.water_assets FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read water assets" ON public.water_assets FOR SELECT TO authenticated USING (true);

-- Water Maintenance Schedule
CREATE TABLE public.water_maintenance_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  asset_id uuid REFERENCES public.water_assets(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  last_done date,
  next_due date NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  assigned_to text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_maintenance_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage water schedule" ON public.water_maintenance_schedule FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read water schedule" ON public.water_maintenance_schedule FOR SELECT TO authenticated USING (true);

-- Water Emergency Tests
CREATE TABLE public.water_emergency_tests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_date date NOT NULL DEFAULT CURRENT_DATE,
  pump_status text NOT NULL DEFAULT 'normal',
  pressure_bar numeric,
  fuel_level text,
  tester_id uuid NOT NULL,
  tester_name text NOT NULL DEFAULT '',
  notes text,
  status text NOT NULL DEFAULT 'pass',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_emergency_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage emergency tests" ON public.water_emergency_tests FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read emergency tests" ON public.water_emergency_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert emergency tests" ON public.water_emergency_tests FOR INSERT TO authenticated WITH CHECK (tester_id = auth.uid());

-- Waste Collection Logs
CREATE TABLE public.waste_collection_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_point text NOT NULL,
  check_in_time timestamptz NOT NULL DEFAULT now(),
  driver_name text NOT NULL,
  status text NOT NULL DEFAULT 'collected',
  recorded_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_collection_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage collection" ON public.waste_collection_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read collection" ON public.waste_collection_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert collection" ON public.waste_collection_logs FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());

-- Waste Room Temperature
CREATE TABLE public.waste_room_temps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_name text NOT NULL DEFAULT 'ห้องพักขยะติดเชื้อ',
  temperature numeric NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  recorded_by uuid NOT NULL,
  recorder_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'normal',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_room_temps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage room temps" ON public.waste_room_temps FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read room temps" ON public.waste_room_temps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert room temps" ON public.waste_room_temps FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());

-- Waste Disposal Records
CREATE TABLE public.waste_disposal_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  waste_type text NOT NULL,
  weight numeric NOT NULL DEFAULT 0,
  disposal_date date NOT NULL DEFAULT CURRENT_DATE,
  disposal_company text,
  certificate_url text,
  photo_url text,
  recorded_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_disposal_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage disposal" ON public.waste_disposal_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read disposal" ON public.waste_disposal_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert disposal" ON public.waste_disposal_records FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());

-- Waste PPE Checks
CREATE TABLE public.waste_ppe_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  worker_name text NOT NULL,
  gloves boolean NOT NULL DEFAULT false,
  mask boolean NOT NULL DEFAULT false,
  gown boolean NOT NULL DEFAULT false,
  boots boolean NOT NULL DEFAULT false,
  checked_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.waste_ppe_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin manage ppe" ON public.waste_ppe_checks FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth read ppe" ON public.waste_ppe_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert ppe" ON public.waste_ppe_checks FOR INSERT TO authenticated WITH CHECK (checked_by = auth.uid());
