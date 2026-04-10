
-- Evacuation beds table for patient tracking
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
ALTER TABLE public.evacuation_beds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read beds" ON public.evacuation_beds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage beds" ON public.evacuation_beds FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can update beds" ON public.evacuation_beds FOR UPDATE TO authenticated USING (true);

-- Department staff count for evacuation tracking
CREATE TABLE public.department_staff_count (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE NOT NULL,
  total_staff INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(department_id)
);
ALTER TABLE public.department_staff_count ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read staff count" ON public.department_staff_count FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage staff count" ON public.department_staff_count FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Fire equipment positions on map (admin configurable)
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
ALTER TABLE public.fire_equipment_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read fire positions" ON public.fire_equipment_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin can manage fire positions" ON public.fire_equipment_positions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Evacuation events log
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
ALTER TABLE public.evacuation_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can read events" ON public.evacuation_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create events" ON public.evacuation_events FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());
CREATE POLICY "Admin can manage events" ON public.evacuation_events FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Authenticated can update events" ON public.evacuation_events FOR UPDATE TO authenticated USING (true);
