
CREATE TABLE public.wayfinding_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_building_key text NOT NULL,
  to_building_key text NOT NULL,
  node_path text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (from_building_key, to_building_key)
);

ALTER TABLE public.wayfinding_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage routes" ON public.wayfinding_routes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read routes" ON public.wayfinding_routes FOR SELECT TO authenticated
  USING (true);
