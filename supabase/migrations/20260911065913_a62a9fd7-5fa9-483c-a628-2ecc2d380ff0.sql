CREATE TABLE public.project_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.consultant_categories(id) ON DELETE CASCADE,
  reason text,
  source text NOT NULL DEFAULT 'ai_suggested',
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, category_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_categories TO authenticated;
GRANT ALL ON public.project_categories TO service_role;

ALTER TABLE public.project_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their project categories"
ON public.project_categories
FOR ALL
TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_categories.project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_categories.project_id AND p.owner_id = auth.uid()));

CREATE INDEX project_categories_project_id_idx ON public.project_categories(project_id);
