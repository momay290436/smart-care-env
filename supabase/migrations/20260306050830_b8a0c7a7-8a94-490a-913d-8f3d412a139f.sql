
-- Wayfinding nodes (road junctions / waypoints)
CREATE TABLE public.wayfinding_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  node_key text NOT NULL UNIQUE,
  label text NOT NULL DEFAULT '',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  is_assembly_point boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Wayfinding edges (road connections between nodes)
CREATE TABLE public.wayfinding_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  to_node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  weight numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(from_node_key, to_node_key)
);

-- Wayfinding buildings (map buildings to nearest road node)
CREATE TABLE public.wayfinding_buildings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_key text NOT NULL UNIQUE,
  name text NOT NULL,
  short_name text NOT NULL DEFAULT '',
  aliases text[] NOT NULL DEFAULT '{}',
  description text NOT NULL DEFAULT '',
  x numeric NOT NULL DEFAULT 50,
  y numeric NOT NULL DEFAULT 50,
  category text NOT NULL DEFAULT 'other',
  node_key text NOT NULL REFERENCES public.wayfinding_nodes(node_key) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.wayfinding_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wayfinding_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wayfinding_buildings ENABLE ROW LEVEL SECURITY;

-- Anyone can read
CREATE POLICY "Anyone can read nodes" ON public.wayfinding_nodes FOR SELECT USING (true);
CREATE POLICY "Anyone can read edges" ON public.wayfinding_edges FOR SELECT USING (true);
CREATE POLICY "Anyone can read buildings" ON public.wayfinding_buildings FOR SELECT USING (true);

-- Admin can manage
CREATE POLICY "Admin can manage nodes" ON public.wayfinding_nodes FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage edges" ON public.wayfinding_edges FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage buildings" ON public.wayfinding_buildings FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
