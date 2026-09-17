ALTER TABLE public.consultant_categories ADD COLUMN IF NOT EXISTS is_continuing boolean NOT NULL DEFAULT false;
