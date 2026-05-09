-- Water Disinfectant Logs
CREATE TABLE public.water_disinfectant_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_time time NOT NULL DEFAULT CURRENT_TIME,
  disinfectant_name text NOT NULL DEFAULT 'คลอรีน',
  source_concentration numeric,
  source_ph numeric,
  outlet_concentration numeric,
  outlet_ph numeric,
  inspector_id uuid NOT NULL,
  inspector_name text NOT NULL DEFAULT '',
  notes text,
  status text NOT NULL DEFAULT 'pass',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.water_disinfectant_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read disinfectant logs" ON public.water_disinfectant_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert disinfectant logs" ON public.water_disinfectant_logs FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());
CREATE POLICY "Admin manage disinfectant logs" ON public.water_disinfectant_logs FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
