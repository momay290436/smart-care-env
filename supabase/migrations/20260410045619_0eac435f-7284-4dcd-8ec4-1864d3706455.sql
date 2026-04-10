
-- Water quality daily logs
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

ALTER TABLE public.water_quality_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read water quality" ON public.water_quality_logs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own water quality" ON public.water_quality_logs
  FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Admin can manage water quality" ON public.water_quality_logs
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

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

ALTER TABLE public.water_meter_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read meter records" ON public.water_meter_records
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own meter records" ON public.water_meter_records
  FOR INSERT TO authenticated WITH CHECK (recorded_by = auth.uid());
CREATE POLICY "Admin can manage meter records" ON public.water_meter_records
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
