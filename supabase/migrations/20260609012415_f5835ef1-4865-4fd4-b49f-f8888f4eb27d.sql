
-- 1) Wastewater treatment inspection logs
CREATE TABLE public.wastewater_inspection_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_date date NOT NULL DEFAULT CURRENT_DATE,
  check_time text,
  chlorine_residual numeric,
  ph_value numeric,
  water_appearance text,
  wastewater_volume numeric,
  inlet_meter numeric,
  outlet_meter numeric,
  aerator_status text DEFAULT 'normal',
  sludge_pump_status text DEFAULT 'normal',
  notes text,
  recorder_name text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wastewater_inspection_logs TO authenticated;
GRANT ALL ON public.wastewater_inspection_logs TO service_role;

ALTER TABLE public.wastewater_inspection_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read wastewater logs"
  ON public.wastewater_inspection_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert wastewater logs"
  ON public.wastewater_inspection_logs FOR INSERT
  TO authenticated WITH CHECK (recorded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage wastewater logs"
  ON public.wastewater_inspection_logs FOR ALL
  TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wastewater_logs_updated_at
  BEFORE UPDATE ON public.wastewater_inspection_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Maintenance schedule: add last inspected date and frequency in months
ALTER TABLE public.water_maintenance_schedule
  ADD COLUMN IF NOT EXISTS last_inspected_date date,
  ADD COLUMN IF NOT EXISTS frequency_months integer;
