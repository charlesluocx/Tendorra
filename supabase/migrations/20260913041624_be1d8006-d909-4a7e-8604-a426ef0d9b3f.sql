ALTER TABLE public.project_documents DROP CONSTRAINT IF EXISTS project_documents_project_id_fkey;
ALTER TABLE public.project_documents ADD CONSTRAINT project_documents_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_categories DROP CONSTRAINT IF EXISTS project_categories_project_id_fkey;
ALTER TABLE public.project_categories ADD CONSTRAINT project_categories_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.project_phases DROP CONSTRAINT IF EXISTS project_phases_project_id_fkey;
ALTER TABLE public.project_phases ADD CONSTRAINT project_phases_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.rfq_scope_items DROP CONSTRAINT IF EXISTS rfq_scope_items_project_id_fkey;
ALTER TABLE public.rfq_scope_items ADD CONSTRAINT rfq_scope_items_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;

ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_project_id_fkey;
ALTER TABLE public.quotes ADD CONSTRAINT quotes_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;
