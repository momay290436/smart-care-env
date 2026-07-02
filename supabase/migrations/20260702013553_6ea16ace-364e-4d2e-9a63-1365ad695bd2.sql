
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.issue_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.issue_areas TO authenticated;
GRANT ALL ON public.issue_areas TO service_role;

ALTER TABLE public.issue_areas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view issue areas"
  ON public.issue_areas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage issue areas"
  ON public.issue_areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_issue_areas_updated_at
  BEFORE UPDATE ON public.issue_areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
