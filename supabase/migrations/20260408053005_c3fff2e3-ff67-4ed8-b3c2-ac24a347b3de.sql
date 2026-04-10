
CREATE TABLE public.page_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  page_key text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, page_key)
);

ALTER TABLE public.page_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage page permissions"
  ON public.page_permissions FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can read own permissions"
  ON public.page_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
