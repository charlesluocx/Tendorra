-- Scope of work items
CREATE TABLE public.rfq_scope_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.consultant_categories(id),
  item_text text NOT NULL,
  source text NOT NULL DEFAULT 'ai_generated',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rfq_scope_items TO authenticated;
GRANT ALL ON public.rfq_scope_items TO service_role;

ALTER TABLE public.rfq_scope_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their project scope items"
ON public.rfq_scope_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = rfq_scope_items.project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = rfq_scope_items.project_id AND p.owner_id = auth.uid()));

CREATE INDEX rfq_scope_items_project_category_idx ON public.rfq_scope_items (project_id, category_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_rfq_scope_items_updated_at
BEFORE UPDATE ON public.rfq_scope_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Project phases log
CREATE TABLE public.project_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, phase)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_phases TO authenticated;
GRANT ALL ON public.project_phases TO service_role;

ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their project phases"
ON public.project_phases FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_phases.project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_phases.project_id AND p.owner_id = auth.uid()));

-- Which phase a category was added under
ALTER TABLE public.project_categories ADD COLUMN phase text;

UPDATE public.project_categories pc
SET phase = p.current_phase
FROM public.projects p
WHERE p.id = pc.project_id AND pc.phase IS NULL;

INSERT INTO public.project_phases (project_id, phase, started_at)
SELECT p.id, p.current_phase, p.created_at
FROM public.projects p
WHERE p.current_phase IS NOT NULL
ON CONFLICT (project_id, phase) DO NOTHING;
