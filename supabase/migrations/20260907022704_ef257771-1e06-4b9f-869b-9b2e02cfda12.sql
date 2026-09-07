CREATE TABLE public.duty_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_staff TO authenticated;
GRANT ALL ON public.duty_staff TO service_role;
ALTER TABLE public.duty_staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duty_staff_select" ON public.duty_staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "duty_staff_admin_write" ON public.duty_staff FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER duty_staff_updated_at BEFORE UPDATE ON public.duty_staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.duty_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_date date NOT NULL,
  shift_type text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.duty_staff(id) ON DELETE CASCADE,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duty_date, shift_type)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_assignments TO authenticated;
GRANT ALL ON public.duty_assignments TO service_role;
ALTER TABLE public.duty_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duty_assign_select" ON public.duty_assignments FOR SELECT TO authenticated USING (true);
CREATE POLICY "duty_assign_admin_write" ON public.duty_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER duty_assignments_updated_at BEFORE UPDATE ON public.duty_assignments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_duty_assignments_date ON public.duty_assignments (duty_date);