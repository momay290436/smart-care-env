ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS simplified_mode boolean NOT NULL DEFAULT false;