
CREATE TABLE public.infectious_waste_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_date DATE NOT NULL,
  transfer_date DATE,
  health_center_name TEXT NOT NULL,
  sharp_waste_kg NUMERIC(10,2) DEFAULT 0,
  non_sharp_waste_kg NUMERIC(10,2) DEFAULT 0,
  delivered_by TEXT,
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.infectious_waste_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view infectious waste records"
  ON public.infectious_waste_records FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert infectious waste records"
  ON public.infectious_waste_records FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Admins can update infectious waste records"
  ON public.infectious_waste_records FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete infectious waste records"
  ON public.infectious_waste_records FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_infectious_waste_updated_at
  BEFORE UPDATE ON public.infectious_waste_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
