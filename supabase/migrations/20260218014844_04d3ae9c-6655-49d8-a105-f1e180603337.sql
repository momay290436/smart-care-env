
-- Equipment categories table
CREATE TABLE public.equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.equipment_categories FOR SELECT USING (true);
CREATE POLICY "Admin can manage categories" ON public.equipment_categories FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Equipment table
CREATE TABLE public.equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  category_id uuid REFERENCES public.equipment_categories(id),
  department_id uuid REFERENCES public.departments(id),
  status text NOT NULL DEFAULT 'active',
  qr_code_url text,
  qr_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read equipment" ON public.equipment FOR SELECT USING (true);
CREATE POLICY "Admin can manage equipment" ON public.equipment FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.generate_equipment_qr_url()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.qr_code_url := 'https://lovable.dev/qr/' || NEW.code;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_equipment_qr_url BEFORE INSERT OR UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.generate_equipment_qr_url();
CREATE TRIGGER update_equipment_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Technicians table
CREATE TABLE public.technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  line_user_id text,
  category_id uuid REFERENCES public.equipment_categories(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read technicians" ON public.technicians FOR SELECT USING (true);
CREATE POLICY "Admin can manage technicians" ON public.technicians FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Repair tickets table
CREATE TABLE public.repair_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipment(id),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'normal',
  photo_url text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  assigned_technician_id uuid REFERENCES public.technicians(id),
  accepted_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.repair_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create repair tickets" ON public.repair_tickets FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Users can read repair tickets" ON public.repair_tickets FOR SELECT USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR created_by = auth.uid()
);
CREATE POLICY "Technicians and admins can update repair tickets" ON public.repair_tickets FOR UPDATE USING (
  has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'technician'::app_role)
);
CREATE POLICY "Admin can delete repair tickets" ON public.repair_tickets FOR DELETE USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_repair_tickets_updated_at BEFORE UPDATE ON public.repair_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
