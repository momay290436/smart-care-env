
-- Add new enum values (must be committed separately before use)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'technician';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
