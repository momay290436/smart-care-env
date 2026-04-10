
CREATE POLICY "Public can read fire checks"
ON public.fire_extinguisher_checks
FOR SELECT
USING (true);
