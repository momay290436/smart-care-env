
-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_5s_created_at ON public.audit_5s(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_5s_department_id ON public.audit_5s(department_id);
CREATE INDEX IF NOT EXISTS idx_fire_checks_checked_at ON public.fire_extinguisher_checks(checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_created_at ON public.maintenance_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_waste_logs_created_at ON public.waste_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_created_at ON public.repair_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_repair_tickets_status ON public.repair_tickets(status);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_id ON public.profiles(auth_id);

-- Add fire extinguisher detail columns
ALTER TABLE public.fire_extinguisher_locations
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS size text,
  ADD COLUMN IF NOT EXISTS extinguisher_type text,
  ADD COLUMN IF NOT EXISTS fuel_type text,
  ADD COLUMN IF NOT EXISTS qr_code_data text;
