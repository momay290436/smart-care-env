CREATE TABLE public.generator_machines (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  sort_order integer NOT NULL DEFAULT 0,
  qr_code_data text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.generator_machines TO authenticated;
GRANT ALL ON public.generator_machines TO service_role;

ALTER TABLE public.generator_machines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view generator machines"
  ON public.generator_machines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage generator machines"
  ON public.generator_machines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER generator_machines_updated_at
  BEFORE UPDATE ON public.generator_machines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.generator_machines (code, name, location, sort_order)
VALUES ('GEN001', 'เครื่องปั่นไฟหลัก', 'อาคารโรงไฟฟ้าสำรอง', 1);