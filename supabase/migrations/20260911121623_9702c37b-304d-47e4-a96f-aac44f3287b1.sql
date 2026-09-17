ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS current_phase text;

UPDATE public.consultant_categories SET status = 'hidden' WHERE name = 'Builder/Head Contractor';
