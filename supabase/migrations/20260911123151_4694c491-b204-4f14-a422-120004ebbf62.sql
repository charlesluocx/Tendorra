CREATE TABLE public.consultants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  category_id uuid NOT NULL REFERENCES public.consultant_categories(id),
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  service_postcode text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX consultants_email_category_key ON public.consultants (lower(email), category_id);

GRANT SELECT, INSERT, UPDATE ON public.consultants TO authenticated;
GRANT SELECT ON public.consultants TO anon;
GRANT ALL ON public.consultants TO service_role;

ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read consultants"
  ON public.consultants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can add consultants"
  ON public.consultants FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Consultants can update their own record"
  ON public.consultants FOR UPDATE TO authenticated
  USING (auth_user_id = auth.uid()) WITH CHECK (auth_user_id = auth.uid());

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  consultant_id uuid NOT NULL REFERENCES public.consultants(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.consultant_categories(id),
  invite_token text NOT NULL UNIQUE,
  fee_amount numeric,
  payment_terms text,
  start_availability date,
  turnaround text,
  status text NOT NULL DEFAULT 'pending',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX quotes_project_id_idx ON public.quotes (project_id);
CREATE INDEX quotes_consultant_id_idx ON public.quotes (consultant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotes TO authenticated;
GRANT ALL ON public.quotes TO service_role;

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage quotes on their projects"
  ON public.quotes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = quotes.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = quotes.project_id AND p.owner_id = auth.uid()));
