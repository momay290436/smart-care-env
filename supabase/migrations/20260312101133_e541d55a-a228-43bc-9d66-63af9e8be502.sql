
-- Fix overly permissive INSERT policy on env_round_items
DROP POLICY "Authenticated can create round items" ON public.env_round_items;

CREATE POLICY "Authenticated can create round items" ON public.env_round_items
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.env_rounds 
      WHERE id = round_id AND inspector_id = auth.uid()
    )
  );
