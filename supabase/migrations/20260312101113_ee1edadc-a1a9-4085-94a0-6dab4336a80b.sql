
-- HAZMAT Inventory: chemicals table
CREATE TABLE public.chemicals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_th text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  storage_building text NOT NULL DEFAULT '',
  storage_floor text NOT NULL DEFAULT '',
  storage_room text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'ขวด',
  current_stock numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  expiry_date date,
  msds_url text,
  ghs_pictograms text[] NOT NULL DEFAULT '{}',
  first_aid_info text NOT NULL DEFAULT '',
  qr_code_data text,
  department_id uuid REFERENCES public.departments(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chemicals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read chemicals" ON public.chemicals
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create chemicals" ON public.chemicals
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admin can manage chemicals" ON public.chemicals
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Chemical transactions (stock in/out)
CREATE TABLE public.chemical_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chemical_id uuid NOT NULL REFERENCES public.chemicals(id) ON DELETE CASCADE,
  transaction_type text NOT NULL CHECK (transaction_type IN ('in', 'out')),
  quantity numeric NOT NULL,
  performed_by uuid NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.chemical_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read transactions" ON public.chemical_transactions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create transactions" ON public.chemical_transactions
  FOR INSERT TO authenticated WITH CHECK (performed_by = auth.uid());

CREATE POLICY "Admin can manage transactions" ON public.chemical_transactions
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ENV Rounds
CREATE TABLE public.env_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid REFERENCES public.departments(id),
  inspector_id uuid NOT NULL,
  inspector_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed')),
  notes text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.env_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read rounds" ON public.env_rounds
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create rounds" ON public.env_rounds
  FOR INSERT TO authenticated WITH CHECK (inspector_id = auth.uid());

CREATE POLICY "Inspector or admin can update rounds" ON public.env_rounds
  FOR UPDATE TO authenticated USING (inspector_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admin can delete rounds" ON public.env_rounds
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- ENV Round Items
CREATE TABLE public.env_round_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL REFERENCES public.env_rounds(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('physical_safety', 'fire_safety', 'waste_chemical', 'utilities')),
  item_name text NOT NULL,
  result text NOT NULL DEFAULT 'normal' CHECK (result IN ('normal', 'abnormal', 'na')),
  severity text CHECK (severity IN ('low', 'medium', 'high')),
  photo_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.env_round_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read round items" ON public.env_round_items
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create round items" ON public.env_round_items
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can manage round items" ON public.env_round_items
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger for updated_at on chemicals
CREATE TRIGGER update_chemicals_updated_at
  BEFORE UPDATE ON public.chemicals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
