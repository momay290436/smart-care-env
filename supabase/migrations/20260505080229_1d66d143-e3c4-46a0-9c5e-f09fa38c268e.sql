
CREATE TABLE public.issues (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  source_module TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'resolved')),
  assigned_to UUID,
  created_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all issues"
  ON public.issues FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create issues"
  ON public.issues FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update issues"
  ON public.issues FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete issues"
  ON public.issues FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_issues_updated_at
  BEFORE UPDATE ON public.issues
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
