
-- Water quality batch testing system
CREATE TABLE public.water_quality_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  water_type TEXT NOT NULL DEFAULT 'wastewater',
  report_period TEXT NOT NULL DEFAULT '',
  test_date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by UUID NOT NULL,
  recorder_name TEXT NOT NULL DEFAULT '',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.water_quality_batch_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  batch_id UUID NOT NULL REFERENCES public.water_quality_batches(id) ON DELETE CASCADE,
  parameter_name TEXT NOT NULL,
  test_result TEXT,
  standard_value TEXT,
  unit TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.water_quality_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.water_quality_batch_items ENABLE ROW LEVEL SECURITY;

-- Policies for batches
CREATE POLICY "Admin can manage batches" ON public.water_quality_batches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create own batches" ON public.water_quality_batches FOR INSERT TO authenticated
  WITH CHECK (recorded_by = auth.uid());

CREATE POLICY "Authenticated can read batches" ON public.water_quality_batches FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own batches" ON public.water_quality_batches FOR UPDATE TO authenticated
  USING (recorded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

-- Policies for batch items
CREATE POLICY "Admin can manage batch items" ON public.water_quality_batch_items FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can create batch items" ON public.water_quality_batch_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.water_quality_batches WHERE id = batch_id AND recorded_by = auth.uid()));

CREATE POLICY "Authenticated can read batch items" ON public.water_quality_batch_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update batch items" ON public.water_quality_batch_items FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.water_quality_batches WHERE id = batch_id AND (recorded_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));

-- Trigger for updated_at
CREATE TRIGGER update_water_quality_batches_updated_at
  BEFORE UPDATE ON public.water_quality_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
