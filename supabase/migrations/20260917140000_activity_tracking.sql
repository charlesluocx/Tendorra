-- Project-activity-tracking module: activity feed, call notes, tagged emails,
-- action items, connected inboxes, a lifecycle checklist (expected vs actual),
-- a stale-project view, and single-company auto-join for Phase 1 signups.
-- Every tenant-owned table here is company_id-scoped from day one.

-- 1. Company auto-join for Phase 1 (single company, no invite flow yet) ------

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  only_company_id uuid;
BEGIN
  -- Phase 1: exactly one company exists, so a new signup joins it
  -- automatically. Once a second company exists (Phase 2 self-serve
  -- signup), this silently stops auto-joining and an explicit invite flow
  -- takes over.
  SELECT id INTO only_company_id FROM public.companies LIMIT 2;
  IF only_company_id IS NOT NULL AND (SELECT count(*) FROM public.companies) = 1 THEN
    INSERT INTO public.company_users (company_id, user_id, role)
    VALUES (only_company_id, NEW.id, 'member')
    ON CONFLICT (company_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 2. Activity feed -------------------------------------------------------------

CREATE TABLE public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('email', 'call_note', 'manual')),
  source_id uuid,
  summary text NOT NULL,
  commitments jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_project_occurred_idx ON public.activity_log(project_id, occurred_at DESC);
CREATE INDEX activity_log_company_idx ON public.activity_log(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_log TO authenticated;
GRANT ALL ON public.activity_log TO service_role;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company activity"
  ON public.activity_log FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.activity_log
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

-- 3. Quick call-note capture, auto-logged to the activity feed ---------------

CREATE TABLE public.call_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  call_date timestamptz NOT NULL DEFAULT now(),
  participants text,
  note_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX call_notes_project_idx ON public.call_notes(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.call_notes TO authenticated;
GRANT ALL ON public.call_notes TO service_role;
ALTER TABLE public.call_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company call notes"
  ON public.call_notes FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.call_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE OR REPLACE FUNCTION public.log_call_note_to_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.activity_log
    (company_id, project_id, source_type, source_id, summary, occurred_at, created_by)
  VALUES
    (NEW.company_id, NEW.project_id, 'call_note', NEW.id, NEW.note_text, NEW.call_date, NEW.created_by);
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_call_note_after_insert
  AFTER INSERT ON public.call_notes
  FOR EACH ROW EXECUTE FUNCTION public.log_call_note_to_activity();

-- 4. Connected inboxes (Microsoft Graph OAuth) --------------------------------
-- Tokens never reach the browser: column-level grants expose only status
-- columns to `authenticated`; access/refresh tokens are readable by
-- service_role only, and all writes go through server code using the
-- service-role client.

CREATE TABLE public.connected_inboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'microsoft',
  email_address text NOT NULL,
  ms_account_id text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  UNIQUE (company_id, user_id, provider)
);

CREATE INDEX connected_inboxes_company_idx ON public.connected_inboxes(company_id);

ALTER TABLE public.connected_inboxes ENABLE ROW LEVEL SECURITY;

GRANT SELECT (id, company_id, user_id, provider, email_address, status, connected_at, last_synced_at)
  ON public.connected_inboxes TO authenticated;
GRANT ALL ON public.connected_inboxes TO service_role;

CREATE POLICY "Company members can view company inbox connections"
  ON public.connected_inboxes FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- No INSERT/UPDATE/DELETE policy for `authenticated`: connecting or
-- disconnecting an inbox always goes through server code running as
-- service_role, which verifies the request before touching tokens.

-- 5. Tagged emails -------------------------------------------------------------

CREATE TABLE public.tagged_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.connected_inboxes(id) ON DELETE SET NULL,
  ms_message_id text NOT NULL,
  subject text,
  from_address text,
  received_at timestamptz,
  body_preview text,
  tagged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tagged_at timestamptz NOT NULL DEFAULT now(),
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'failed')),
  parsed_at timestamptz,
  activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL,
  UNIQUE (connection_id, ms_message_id)
);

CREATE INDEX tagged_emails_project_idx ON public.tagged_emails(project_id);
CREATE INDEX tagged_emails_pending_idx ON public.tagged_emails(parse_status) WHERE parse_status = 'pending';

GRANT SELECT, INSERT, UPDATE ON public.tagged_emails TO authenticated;
GRANT ALL ON public.tagged_emails TO service_role;
ALTER TABLE public.tagged_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company tagged emails"
  ON public.tagged_emails FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.tagged_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

-- 6. Owner-assigned action items ----------------------------------------------

CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done')),
  due_date date,
  source_activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX action_items_project_idx ON public.action_items(project_id);
CREATE INDEX action_items_assignee_idx ON public.action_items(assigned_to) WHERE status <> 'done';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.action_items TO authenticated;
GRANT ALL ON public.action_items TO service_role;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company action items"
  ON public.action_items FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER update_action_items_updated_at
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Guided lifecycle checklist: a shared template, and per-project progress
-- that tracks expected vs actual dates separately ------------------------------

CREATE TABLE public.lifecycle_phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position integer NOT NULL
);

CREATE TABLE public.lifecycle_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.lifecycle_phases(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL
);

GRANT SELECT ON public.lifecycle_phases TO authenticated;
GRANT SELECT ON public.lifecycle_checklist_items TO authenticated;
GRANT ALL ON public.lifecycle_phases TO service_role;
GRANT ALL ON public.lifecycle_checklist_items TO service_role;
ALTER TABLE public.lifecycle_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lifecycle_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read the lifecycle template"
  ON public.lifecycle_phases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read the checklist template"
  ON public.lifecycle_checklist_items FOR SELECT TO authenticated USING (true);

INSERT INTO public.lifecycle_phases (name, position) VALUES
  ('Feasibility', 1),
  ('Approval', 2),
  ('Construction', 3),
  ('Handover', 4);

INSERT INTO public.lifecycle_checklist_items (phase_id, title, position)
SELECT id, item, ord FROM public.lifecycle_phases
JOIN LATERAL (
  VALUES
    ('Feasibility', 'Confirm site and budget feasibility', 1),
    ('Feasibility', 'Engage architect and town planner', 2),
    ('Approval', 'Lodge planning/permit application', 1),
    ('Approval', 'Respond to council requests for information', 2),
    ('Approval', 'Receive permit approval', 3),
    ('Construction', 'Appoint builder/head contractor', 1),
    ('Construction', 'Site works commence', 2),
    ('Construction', 'Practical completion inspection', 3),
    ('Handover', 'Final defects resolved', 1),
    ('Handover', 'Keys/handover to client', 2)
) AS seed(phase, item, ord) ON seed.phase = lifecycle_phases.name;

CREATE TABLE public.project_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  phase_id uuid NOT NULL REFERENCES public.lifecycle_phases(id),
  template_item_id uuid REFERENCES public.lifecycle_checklist_items(id) ON DELETE SET NULL,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'skipped')),
  expected_at date,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX project_checklist_items_project_idx ON public.project_checklist_items(project_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_checklist_items TO authenticated;
GRANT ALL ON public.project_checklist_items TO service_role;
ALTER TABLE public.project_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company checklist items"
  ON public.project_checklist_items FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.project_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();

CREATE TRIGGER update_project_checklist_items_updated_at
  BEFORE UPDATE ON public.project_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a new project's checklist from the template the moment it's created.
CREATE OR REPLACE FUNCTION public.seed_project_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_checklist_items
    (company_id, project_id, phase_id, template_item_id, title, position)
  SELECT NEW.company_id, NEW.id, lci.phase_id, lci.id, lci.title,
         (lp.position * 100) + lci.position
  FROM public.lifecycle_checklist_items lci
  JOIN public.lifecycle_phases lp ON lp.id = lci.phase_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_project_checklist_after_insert
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.seed_project_checklist();

-- Backfill checklists for the 16 projects that already existed.
INSERT INTO public.project_checklist_items
  (company_id, project_id, phase_id, template_item_id, title, position)
SELECT p.company_id, p.id, lci.phase_id, lci.id, lci.title, (lp.position * 100) + lci.position
FROM public.projects p
CROSS JOIN public.lifecycle_checklist_items lci
JOIN public.lifecycle_phases lp ON lp.id = lci.phase_id;

-- 8. Stale-project view for the auto-flag rule ---------------------------------
-- security_invoker so the view runs under the querying user's own RLS
-- instead of the view creator's.

CREATE VIEW public.project_activity_status
WITH (security_invoker = true) AS
SELECT
  p.id AS project_id,
  p.company_id,
  p.name,
  MAX(al.occurred_at) AS last_activity_at,
  c.stale_after_days,
  (
    MAX(al.occurred_at) IS NULL
    OR MAX(al.occurred_at) < now() - (c.stale_after_days || ' days')::interval
  ) AS is_stale
FROM public.projects p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.activity_log al ON al.project_id = p.id
GROUP BY p.id, p.company_id, p.name, c.stale_after_days;

GRANT SELECT ON public.project_activity_status TO authenticated;

-- 9. Lock down SECURITY DEFINER functions from anonymous/direct RPC access ---
-- Trigger functions should only run inside a trigger, never as a directly
-- callable RPC; Postgres grants EXECUTE to PUBLIC by default on creation.

REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_call_note_to_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.seed_project_checklist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_id_from_project() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_company_id_from_self() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_company_member(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
