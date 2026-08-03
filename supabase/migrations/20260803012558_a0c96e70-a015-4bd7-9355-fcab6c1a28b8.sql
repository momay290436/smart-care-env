ALTER TABLE public.electricity_meters
  ADD COLUMN IF NOT EXISTS residents jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text;