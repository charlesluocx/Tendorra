CREATE TABLE public.consultant_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_predefined boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.consultant_categories TO authenticated;
GRANT ALL ON public.consultant_categories TO service_role;

ALTER TABLE public.consultant_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read categories"
  ON public.consultant_categories FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can submit categories"
  ON public.consultant_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND is_predefined = false);

CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  project_type text,
  status text NOT NULL DEFAULT 'active',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage their own projects"
  ON public.projects FOR ALL TO authenticated
  USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX projects_owner_id_idx ON public.projects(owner_id);

INSERT INTO public.consultant_categories (name, is_predefined, status) VALUES
('Architect', true, 'active'),
('Building Designer', true, 'active'),
('Land Surveyor', true, 'active'),
('Arborist', true, 'active'),
('Town Planner', true, 'active'),
('Traffic Engineer', true, 'active'),
('Acoustic Consultant', true, 'active'),
('Waste Management Consultant', true, 'active'),
('Heritage Consultant', true, 'active'),
('Bushfire Consultant', true, 'active'),
('Native Vegetation/Ecology Consultant', true, 'active'),
('Environmental/Contamination Consultant', true, 'active'),
('Landscape Architect', true, 'active'),
('Urban Designer', true, 'active'),
('Structural Engineer', true, 'active'),
('Civil Engineer', true, 'active'),
('Geotechnical Engineer', true, 'active'),
('Building Surveyor', true, 'active'),
('Project Manager', true, 'active'),
('Fire Engineer', true, 'active'),
('Hydraulic Engineer', true, 'active'),
('Electrical Engineer', true, 'active'),
('Mechanical Engineer', true, 'active'),
('ESD/Sustainability Consultant', true, 'active'),
('Access Consultant', true, 'active'),
('Quantity Surveyor', true, 'active'),
('Sales/Project Marketing Agent', true, 'active'),
('Conveyancer/Property Lawyer', true, 'active'),
('Owners Corporation Manager', true, 'active'),
('Builder/Head Contractor', true, 'active');
