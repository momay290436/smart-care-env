-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Auth read disinfectant logs" ON public.water_disinfectant_logs;
DROP POLICY IF EXISTS "Auth insert disinfectant logs" ON public.water_disinfectant_logs;
DROP POLICY IF EXISTS "Admin manage disinfectant logs" ON public.water_disinfectant_logs;

-- Recreate the table if it doesn't exist with proper structure
CREATE TABLE IF NOT EXISTS public.water_disinfectant_logs (
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

-- Enable RLS
ALTER TABLE public.water_disinfectant_logs ENABLE ROW LEVEL SECURITY;

-- Create new policies without custom functions
CREATE POLICY "Anyone can read disinfectant logs" ON public.water_disinfectant_logs 
  FOR SELECT TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can insert disinfectant logs" ON public.water_disinfectant_logs 
  FOR INSERT TO authenticated 
  WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "Anyone can update disinfectant logs" ON public.water_disinfectant_logs 
  FOR UPDATE TO authenticated 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Anyone can delete disinfectant logs" ON public.water_disinfectant_logs 
  FOR DELETE TO authenticated 
  USING (true);
