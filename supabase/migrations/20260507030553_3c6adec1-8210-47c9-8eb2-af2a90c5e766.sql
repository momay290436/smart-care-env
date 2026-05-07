
-- env_round_items.round_id -> env_rounds.id
ALTER TABLE public.env_round_items
  ADD CONSTRAINT fk_env_round_items_round
  FOREIGN KEY (round_id) REFERENCES public.env_rounds(id) ON DELETE CASCADE;

-- env_rounds.department_id -> departments.id
ALTER TABLE public.env_rounds
  ADD CONSTRAINT fk_env_rounds_department
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- fire_extinguisher_checks.department_id -> departments.id
ALTER TABLE public.fire_extinguisher_checks
  ADD CONSTRAINT fk_fire_checks_department
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;

-- audit_5s.department_id -> departments.id
ALTER TABLE public.audit_5s
  ADD CONSTRAINT fk_audit_5s_department
  FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;
