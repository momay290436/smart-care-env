CREATE TABLE public.water_emergency_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  started_by uuid REFERENCES auth.users(id),
  ended_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.water_emergency_events TO authenticated;
GRANT ALL ON public.water_emergency_events TO service_role;

ALTER TABLE public.water_emergency_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read emergency events"
  ON public.water_emergency_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can start emergency event"
  ON public.water_emergency_events FOR INSERT TO authenticated
  WITH CHECK (started_by = auth.uid());

CREATE POLICY "Authenticated can end emergency event"
  ON public.water_emergency_events FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER water_emergency_events_set_updated_at
  BEFORE UPDATE ON public.water_emergency_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX water_emergency_events_open_idx ON public.water_emergency_events (started_at DESC) WHERE ended_at IS NULL;