CREATE TABLE public.generator_checks (
  id uuid primary key default gen_random_uuid(),
  machine_code text not null default 'GEN001',
  check_date date not null default current_date,
  recorder_id uuid,
  recorder_name text not null default '',
  hour_meter numeric,
  oil_level text,
  coolant_level text,
  fuel_level text,
  battery_voltage numeric,
  leak_status text,
  ats_status text,
  noload_result text,
  rpm numeric,
  frequency_hz numeric,
  test_start_time time,
  test_stop_time time,
  test_duration_min numeric,
  room_cleanliness text,
  battery_terminal text,
  onload_ats text,
  voltage_l1 numeric, voltage_l2 numeric, voltage_l3 numeric,
  current_l1 numeric, current_l2 numeric, current_l3 numeric,
  coolant_temp numeric,
  oil_pressure numeric,
  overall_status text not null default 'ready',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.generator_checks TO authenticated;
GRANT ALL ON public.generator_checks TO service_role;
ALTER TABLE public.generator_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gen_checks_read" ON public.generator_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "gen_checks_insert" ON public.generator_checks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gen_checks_update" ON public.generator_checks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "gen_checks_delete" ON public.generator_checks FOR DELETE TO authenticated USING (recorder_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER generator_checks_updated_at BEFORE UPDATE ON public.generator_checks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.pump_machines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  machine_type text not null default 'pump',
  sort_order integer not null default 0,
  qr_code_data text,
  created_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pump_machines TO authenticated;
GRANT ALL ON public.pump_machines TO service_role;
ALTER TABLE public.pump_machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pump_machines_read" ON public.pump_machines FOR SELECT TO authenticated USING (true);
CREATE POLICY "pump_machines_write" ON public.pump_machines FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.pump_meter_logs (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.pump_machines(id) on delete cascade,
  record_date date not null default current_date,
  record_time time not null default current_time,
  meter_reading numeric not null,
  previous_reading numeric,
  hours_used numeric,
  recorder_id uuid,
  recorder_name text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pump_meter_logs TO authenticated;
GRANT ALL ON public.pump_meter_logs TO service_role;
ALTER TABLE public.pump_meter_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pump_logs_read" ON public.pump_meter_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "pump_logs_insert" ON public.pump_meter_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "pump_logs_update" ON public.pump_meter_logs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "pump_logs_delete" ON public.pump_meter_logs FOR DELETE TO authenticated USING (recorder_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER pump_meter_logs_updated_at BEFORE UPDATE ON public.pump_meter_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_pump_meter_logs_machine_date ON public.pump_meter_logs (machine_id, record_date);

INSERT INTO public.pump_machines (name, machine_type, sort_order) VALUES
 ('เครื่องสูบน้ำเสีย ที่ 1','pump',1),
 ('เครื่องสูบน้ำเสีย ที่ 2','pump',2),
 ('เครื่องสูบน้ำเสีย ที่ 3','pump',3),
 ('เครื่องสูบน้ำเสีย ที่ 4','pump',4),
 ('เครื่องควบคุม/เติมอากาศ ที่ 1','aerator',5),
 ('เครื่องควบคุม/เติมอากาศ ที่ 2','aerator',6);