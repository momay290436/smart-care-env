-- Create wastewater statistics daily report table (สถิติและข้อมูลผลการทำงานของระบบบำบัดน้ำเสีย)
CREATE TABLE public.wastewater_statistics_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_date DATE NOT NULL,
  electricity_usage NUMERIC,
  water_usage NUMERIC,
  wastewater_volume NUMERIC,
  discharge_method TEXT,
  chemical_substances TEXT,
  chemical_amount NUMERIC,
  treatment_system_status TEXT DEFAULT 'normal',
  water_pump_status TEXT DEFAULT 'normal',
  aerator_status TEXT DEFAULT 'normal',
  mixer_wastewater_status TEXT DEFAULT 'normal',
  mixer_chemical_status TEXT DEFAULT 'normal',
  sludge_pump_status TEXT DEFAULT 'normal',
  sludge_pump_used BOOLEAN DEFAULT false,
  other_equipment_status TEXT,
  excess_sludge_volume NUMERIC,
  problems_and_solutions TEXT,
  recorded_by UUID,
  recorder_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wastewater_statistics_logs TO authenticated;
GRANT ALL ON public.wastewater_statistics_logs TO service_role;

ALTER TABLE public.wastewater_statistics_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view wastewater statistics"
  ON public.wastewater_statistics_logs FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert wastewater statistics"
  ON public.wastewater_statistics_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Recorders and admins can update wastewater statistics"
  ON public.wastewater_statistics_logs FOR UPDATE
  TO authenticated USING (recorded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Recorders and admins can delete wastewater statistics"
  ON public.wastewater_statistics_logs FOR DELETE
  TO authenticated USING (recorded_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_wastewater_statistics_logs_updated_at
  BEFORE UPDATE ON public.wastewater_statistics_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_wastewater_statistics_record_date ON public.wastewater_statistics_logs(record_date DESC);

-- Extend wastewater_inspection_logs: support multi-select water_appearance + custom treated_water_color
ALTER TABLE public.wastewater_inspection_logs
  ADD COLUMN IF NOT EXISTS water_appearance_options TEXT[],
  ADD COLUMN IF NOT EXISTS treated_water_color_custom TEXT;