
-- Add inspection_details jsonb column for detailed checklist
ALTER TABLE public.fire_extinguisher_checks
ADD COLUMN IF NOT EXISTS inspection_details jsonb DEFAULT '{}'::jsonb;

-- Add inspector_name for recording who inspected
ALTER TABLE public.fire_extinguisher_checks
ADD COLUMN IF NOT EXISTS inspector_name text;
