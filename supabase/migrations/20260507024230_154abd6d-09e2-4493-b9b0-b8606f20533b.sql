
-- Remove duplicate roles keeping the most privileged one
-- For user 53fe76c0: keep manager, delete user role
DELETE FROM public.user_roles WHERE id = '80c09cfa-a3ab-4d6a-941a-3230a2cb3ac3';
-- For user f745bf19: keep admin, delete user role
DELETE FROM public.user_roles WHERE id = 'acb65ac4-b7a6-459e-9305-4c8257eba8cb';

-- Now add unique constraint on user_id alone
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Add columns to issues table
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS resolution_notes text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS department_name text;
