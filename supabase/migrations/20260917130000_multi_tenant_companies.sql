-- Phase 1 of the project-activity-tracking module: introduce companies as the
-- tenant boundary now, even though only one company exists today, so Phase 2
-- (selling this as a service) is "turn on billing" rather than a schema rework.
--
-- Tenant-owned data (a project and everything that hangs off it) gets a
-- company_id and company-scoped RLS. The shared consultant network
-- (consultant_categories, consultants) is intentionally left alone: those
-- tables are a cross-company marketplace/taxonomy by design (see their
-- existing "true" SELECT policies) and forcing a company_id onto them would
-- silo data that is supposed to stay shared.

-- 1. Companies and membership -------------------------------------------------

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  plan text NOT NULL DEFAULT 'internal',
  stale_after_days integer NOT NULL DEFAULT 7,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.company_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

GRANT SELECT ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT ON public.company_users TO authenticated;
GRANT ALL ON public.company_users TO service_role;

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_users ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER so it can read company_users without recursing through the
-- RLS policy that itself calls this function.
CREATE OR REPLACE FUNCTION public.is_company_member(cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.company_users cu
    WHERE cu.company_id = cid AND cu.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;

-- The company_id to stamp onto a row the current user inserts, when the
-- client doesn't set one explicitly. Phase 1 users belong to exactly one
-- company, so "first membership" is unambiguous.
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.company_users WHERE user_id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;

CREATE POLICY "Members can read their company"
  ON public.companies FOR SELECT TO authenticated
  USING (public.is_company_member(id));

CREATE POLICY "Members can read their company roster"
  ON public.company_users FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- 2. Bootstrap a single company from today's data -----------------------------

INSERT INTO public.companies (name, slug, plan)
VALUES ('Tendorra', 'tendorra', 'internal');

INSERT INTO public.company_users (company_id, user_id, role)
SELECT c.id, u.id, 'member'
FROM public.companies c
CROSS JOIN (
  SELECT DISTINCT owner_id AS id FROM public.projects
  UNION
  SELECT DISTINCT auth_user_id FROM public.consultants WHERE auth_user_id IS NOT NULL
  UNION
  SELECT DISTINCT created_by FROM public.consultant_categories WHERE created_by IS NOT NULL
) u
WHERE c.slug = 'tendorra'
ON CONFLICT (company_id, user_id) DO NOTHING;

UPDATE public.company_users cu
SET role = 'owner'
FROM public.companies c
WHERE cu.company_id = c.id
  AND c.slug = 'tendorra'
  AND cu.user_id IN (SELECT DISTINCT owner_id FROM public.projects);

-- 3. company_id on every tenant-owned table -----------------------------------

ALTER TABLE public.projects ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.project_documents ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.project_categories ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.project_phases ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.rfq_scope_items ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.quotes ADD COLUMN company_id uuid REFERENCES public.companies(id);

UPDATE public.projects SET company_id = (SELECT id FROM public.companies WHERE slug = 'tendorra');
UPDATE public.project_documents pd SET company_id = p.company_id FROM public.projects p WHERE p.id = pd.project_id;
UPDATE public.project_categories pc SET company_id = p.company_id FROM public.projects p WHERE p.id = pc.project_id;
UPDATE public.project_phases pp SET company_id = p.company_id FROM public.projects p WHERE p.id = pp.project_id;
UPDATE public.rfq_scope_items rsi SET company_id = p.company_id FROM public.projects p WHERE p.id = rsi.project_id;
UPDATE public.quotes q SET company_id = p.company_id FROM public.projects p WHERE p.id = q.project_id;

ALTER TABLE public.projects ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.project_documents ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.project_categories ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.project_phases ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.rfq_scope_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.quotes ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX projects_company_id_idx ON public.projects(company_id);
CREATE INDEX project_documents_company_id_idx ON public.project_documents(company_id);
CREATE INDEX project_categories_company_id_idx ON public.project_categories(company_id);
CREATE INDEX project_phases_company_id_idx ON public.project_phases(company_id);
CREATE INDEX rfq_scope_items_company_id_idx ON public.rfq_scope_items(company_id);
CREATE INDEX quotes_company_id_idx ON public.quotes(company_id);

-- 4. Auto-stamp company_id on insert so existing client code (which doesn't
-- set company_id) keeps working without a rewrite -----------------------------

CREATE OR REPLACE FUNCTION public.set_company_id_from_self()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    NEW.company_id := public.current_company_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_company_id_from_project()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id FROM public.projects WHERE id = NEW.project_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_self();

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.project_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.project_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.rfq_scope_items
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

-- 5. Switch RLS from "owner_id = auth.uid()" to company membership, so the
-- whole team can see and manage shared projects, not just the creator --------

DROP POLICY "Owners can manage their own projects" ON public.projects;
CREATE POLICY "Company members can manage company projects"
  ON public.projects FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY "Owners can manage their project documents" ON public.project_documents;
CREATE POLICY "Company members can manage company project documents"
  ON public.project_documents FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY "Owners can manage their project categories" ON public.project_categories;
CREATE POLICY "Company members can manage company project categories"
  ON public.project_categories FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY "Owners can manage their project phases" ON public.project_phases;
CREATE POLICY "Company members can manage company project phases"
  ON public.project_phases FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY "Owners can manage their project scope items" ON public.rfq_scope_items;
CREATE POLICY "Company members can manage company scope items"
  ON public.rfq_scope_items FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

DROP POLICY "Owners can manage quotes on their projects" ON public.quotes;
CREATE POLICY "Company members can manage company quotes"
  ON public.quotes FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

-- Storage policies keyed off projects.owner_id become company-scoped too, so
-- any team member can see/manage documents uploaded by a teammate.
DROP POLICY IF EXISTS "Owners can upload their project files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read their project files" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their project files" ON storage.objects;

CREATE POLICY "Company members can upload their project files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE public.is_company_member(p.company_id)
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Company members can read their project files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE public.is_company_member(p.company_id)
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);

CREATE POLICY "Company members can delete their project files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'project-documents'
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE public.is_company_member(p.company_id)
      AND p.id::text = (storage.foldername(storage.objects.name))[1]
  )
);
