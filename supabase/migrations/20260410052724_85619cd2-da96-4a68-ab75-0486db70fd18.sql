
DROP POLICY "Authenticated can update beds" ON public.evacuation_beds;
CREATE POLICY "Authenticated can update beds" ON public.evacuation_beds FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY "Authenticated can update events" ON public.evacuation_events;
CREATE POLICY "Authenticated can update events" ON public.evacuation_events FOR UPDATE TO authenticated
  USING (reported_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));
