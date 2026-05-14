-- Add disinfectant log fields to water_quality_logs so water disinfectant checks can be saved in the same table
ALTER TABLE public.water_quality_logs
  ADD COLUMN IF NOT EXISTS check_time time,
  ADD COLUMN IF NOT EXISTS disinfectant_name text,
  ADD COLUMN IF NOT EXISTS source_concentration numeric,
  ADD COLUMN IF NOT EXISTS source_ph numeric,
  ADD COLUMN IF NOT EXISTS outlet_concentration numeric,
  ADD COLUMN IF NOT EXISTS outlet_ph numeric,
  ADD COLUMN IF NOT EXISTS inspector_name text;
