-- Company-wide shared Gmail inbox + per-project email codes, so staff can
-- forward/CC relevant emails to one shared address per company (using
-- Gmail's "+tag" addressing to route each email to the right project) and
-- have them parsed straight into that project's activity feed — no OAuth
-- per staff member, no manual per-email tagging required.

-- 1. Per-project short code used as the Gmail "+" tag ------------------------

ALTER TABLE public.projects
  ADD COLUMN email_code text NOT NULL
    DEFAULT upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

CREATE UNIQUE INDEX projects_company_email_code_idx
  ON public.projects(company_id, email_code);

-- 2. One shared Gmail connection per company ----------------------------------

CREATE TABLE public.company_gmail_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  email_address text NOT NULL,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'error')),
  connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz
);

ALTER TABLE public.company_gmail_inbox ENABLE ROW LEVEL SECURITY;

GRANT SELECT (id, company_id, email_address, status, connected_by, connected_at, last_synced_at)
  ON public.company_gmail_inbox TO authenticated;
GRANT ALL ON public.company_gmail_inbox TO service_role;

CREATE POLICY "Company members can view their company's Gmail connection"
  ON public.company_gmail_inbox FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));

-- No INSERT/UPDATE/DELETE policy for `authenticated`: connecting or
-- disconnecting always goes through server code running as service_role,
-- same pattern as connected_inboxes.

-- 3. Log of every Gmail message pulled in, matched to a project by its
--    "+code" address, and parsed into activity_log ---------------------------

CREATE TABLE public.project_email_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  gmail_message_id text NOT NULL,
  subject text,
  from_address text,
  received_at timestamptz,
  parse_status text NOT NULL DEFAULT 'pending'
    CHECK (parse_status IN ('pending', 'parsed', 'failed', 'unmatched')),
  parsed_at timestamptz,
  activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, gmail_message_id)
);

CREATE INDEX project_email_events_project_idx ON public.project_email_events(project_id);

ALTER TABLE public.project_email_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.project_email_events TO authenticated;
GRANT ALL ON public.project_email_events TO service_role;

CREATE POLICY "Company members can view their company's email events"
  ON public.project_email_events FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
