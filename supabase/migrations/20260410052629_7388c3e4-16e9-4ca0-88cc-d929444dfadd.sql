
-- Wayfinding nodes
CREATE TABLE public.wayfinding_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  is_assembly_point boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wayfinding edges
CREATE TABLE public.wayfinding_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  to_node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  weight numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_node_key, to_node_key)
);

-- Wayfinding buildings
CREATE TABLE public.wayfinding_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_key text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL DEFAULT '',
  aliases text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  category text NOT NULL DEFAULT 'other',
  node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wayfinding routes
CREATE TABLE public.wayfinding_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_building_key text NOT NULL,
  to_building_key text NOT NULL,
  node_path text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_building_key, to_building_key)
);

-- Chemicals
CREATE TABLE public.chemicals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  storage_building text NOT NULL DEFAULT '',
  storage_floor text NOT NULL DEFAULT '',
  storage_room text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ขวด',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  expiry_date date,
  msds_url text,
  ghs_pictograms text[] NOT NULL DEFAULT '{}',
  first_aid_info text NOT NULL DEFAULT '',
  qr_code_data text,
  department_id uuid REFERENCES public.departments(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Chemical transactions
CREATE TABLE public.chemical_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id uuid NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity numeric NOT NULL,
  performed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ENV Rounds
CREATE TABLE public.env_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id),
  inspector_id uuid NOT NULL,
  inspector_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ENV Round Items
CREATE TABLE public.env_round_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.env_rounds(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('physical_safety', 'fire_safety', 'waste_chemical', 'utilities')),
  item_name text NOT NULL,
  result text NOT NULL DEFAULT 'normal' CHECK (result IN ('normal', 'abnormal', 'na')),
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Evacuation beds
CREATE TABLE public.evacuation_beds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bed_number TEXT NOT NULL,
  ward TEXT NOT NULL DEFAULT 'IPD',
  priority INTEGER NOT NULL DEFAULT 2,
  has_patient BOOLEAN NOT NULL DEFAULT false,
  patient_name TEXT,
  is_safe BOOLEAN NOT NULL DEFAULT false,
  safe_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Department staff count
CREATE TABLE public.department_staff_count (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  total_staff INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id)
);

-- Fire equipment positions
CREATE TABLE public.fire_equipment_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_type TEXT NOT NULL DEFAULT 'extinguisher',
  sub_type TEXT,
  label TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 50,
  y NUMERIC NOT NULL DEFAULT 50,
  building TEXT,
  floor TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Evacuation events
CREATE TABLE public.evacuation_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  building TEXT NOT NULL,
  floor TEXT,
  reported_by UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  patients_safe INTEGER NOT NULL DEFAULT 0,
  patients_total INTEGER NOT NULL DEFAULT 0,
  staff_safe INTEGER NOT NULL DEFAULT 0,
  staff_total INTEGER NOT NULL DEFAULT 0,
  visitors_safe INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- Schedule events
CREATE TABLE public.schedule_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL DEFAULT '5s',
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  color TEXT DEFAULT '#0891b2',
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Department QR points
CREATE TABLE public.department_qr_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  point_name TEXT NOT NULL,
  qr_code_data TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Page permissions
CREATE TABLE public.page_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

-- Water quality logs
CREATE TABLE public.water_quality_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_point text NOT NULL DEFAULT '',
  ph_value numeric,
  chlorine_value numeric,
  turbidity_value numeric,
  status text NOT NULL DEFAULT 'pass',
  notes text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Water meter records
CREATE TABLE public.water_meter_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  record_time time NOT NULL DEFAULT CURRENT_TIME,
  shift text NOT NULL DEFAULT 'morning',
  meter_reading numeric NOT NULL DEFAULT 0,
  usage_amount numeric NOT NULL DEFAULT 0,
  daily_total numeric,
  recorded_by uuid NOT NULL,
  recorder_name text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.wayfinding_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wayfinding_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wayfinding_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wayfinding_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chemical_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.env_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.env_round_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_staff_count ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fire_equipment_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evacuation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_qr_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_quality_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_meter_records ENABLE ROW LEVEL SECURITY;

-- RLS: wayfinding
CREATE POLICY "Anyone can read nodes" ON public.wayfinding_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can read edges" ON public.wayfinding_edges FOR SELECT USING (true);
CREATE POLICY "Anyone can read buildings" ON public.wayfinding_buildings FOR SELECT USING (true);
CREATE POLICY "Anyone can read routes" ON public.wayfinding_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage nodes" ON public.wayfinding_nodes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage edges" ON public.wayfinding_edges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage buildings" ON public.wayfinding_buildings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage routes" ON public.wayfinding_routes FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- RLS: chemicals
CREATE POLICY "Authenticated can read chemicals" ON public.chemicals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create chemicals" ON public.chemicals FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admin can manage chemicals" ON public.chemicals FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read transactions" ON public.chemical_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create transactions" ON public.chemical_transactions FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());
CREATE POLICY "Admin can manage transactions" ON public.chemical_transactions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: env_rounds
CREATE POLICY "Authenticated can read rounds" ON public.env_rounds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create rounds" ON public.env_rounds FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());
CREATE POLICY "Inspector or admin can update rounds" ON public.env_rounds FOR UPDATE TO authenticated USING (inspector_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can delete rounds" ON public.env_rounds FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: env_round_items
CREATE POLICY "Authenticated can read round items" ON public.env_round_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create round items" ON public.env_round_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.env_rounds WHERE id = round_id AND inspector_id = auth.uid())
);
CREATE POLICY "Admin can manage round items" ON public.env_round_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS: evacuation
CREATE POLICY "Anyone authenticated can read beds" ON public.evacuation_beds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage beds" ON public.evacuation_beds FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can update beds" ON public.evacuation_beds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone authenticated can read staff count" ON public.department_staff_count FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage staff count" ON public.department_staff_count FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can read fire positions" ON public.fire_equipment_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage fire positions" ON public.fire_equipment_positions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone authenticated can read events" ON public.evacuation_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create events" ON public.evacuation_events FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Admin can manage events" ON public.evacuation_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can update events" ON public.evacuation_events FOR UPDATE TO authenticated USING (true);

-- RLS: schedule_events
CREATE POLICY "Admin can manage schedule events" ON public.schedule_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read schedule events" ON public.schedule_events FOR SELECT TO authenticated USING (true);

-- RLS: department_qr_points
CREATE POLICY "Admin can manage QR points" ON public.department_qr_points FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read QR points" ON public.department_qr_points FOR SELECT TO authenticated USING (true);

-- RLS: page_permissions
CREATE POLICY "Admin can manage page permissions" ON public.page_permissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can read own permissions" ON public.page_permissions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS: water
CREATE POLICY "Authenticated can read water quality" ON public.water_quality_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own water quality" ON public.water_quality_logs FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Admin can manage water quality" ON public.water_quality_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can read meter records" ON public.water_meter_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own meter records" ON public.water_meter_records FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Admin can manage meter records" ON public.water_meter_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Triggers
CREATE TRIGGER update_chemicals_updated_at BEFORE UPDATE ON public.chemicals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_schedule_events_updated_at BEFORE UPDATE ON public.schedule_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
