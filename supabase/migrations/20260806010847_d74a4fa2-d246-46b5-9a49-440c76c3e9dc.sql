CREATE TABLE public.notification_recipients (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  line_user_id text not null,
  topics text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_recipients TO authenticated;
GRANT ALL ON public.notification_recipients TO service_role;
ALTER TABLE public.notification_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notification_recipients" ON public.notification_recipients FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage notification_recipients" ON public.notification_recipients FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER notification_recipients_updated_at BEFORE UPDATE ON public.notification_recipients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sewage_trash_options (
  id uuid primary key default gen_random_uuid(),
  label text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sewage_trash_options TO authenticated;
GRANT ALL ON public.sewage_trash_options TO service_role;
ALTER TABLE public.sewage_trash_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sewage_trash_options" ON public.sewage_trash_options FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin manage sewage_trash_options" ON public.sewage_trash_options FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.sewage_trash_options (label, sort_order) VALUES
 ('เศษอาหาร',1),('ทิชชู่',2),('เส้นผม',3),('เศษผ้า',4),('พลาสติก',5),('ใบไม้',6),('ถุงมือ',7);

CREATE TABLE public.sewage_trash_logs (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default (now() at time zone 'Asia/Bangkok')::date,
  record_time time not null default (now() at time zone 'Asia/Bangkok')::time,
  round text not null default 'morning',
  weight_kg numeric not null default 0,
  items text[] not null default '{}',
  other_item text,
  recorder_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sewage_trash_logs TO authenticated;
GRANT ALL ON public.sewage_trash_logs TO service_role;
ALTER TABLE public.sewage_trash_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sewage_trash_logs" ON public.sewage_trash_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert sewage_trash_logs" ON public.sewage_trash_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "admin update sewage_trash_logs" ON public.sewage_trash_logs FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "admin delete sewage_trash_logs" ON public.sewage_trash_logs FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE INDEX sewage_trash_logs_date_idx ON public.sewage_trash_logs (record_date DESC);
CREATE TRIGGER sewage_trash_logs_updated_at BEFORE UPDATE ON public.sewage_trash_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();