-- Auto-sync a project's timeline from Outlook, using the category a staff
-- member already tags emails with in their own inbox, rather than requiring
-- a forward to a shared inbox. The Graph API filters by category
-- server-side (see listMessagesByCategory in src/lib/microsoft-graph.ts),
-- so untagged mail is never fetched at all — a stronger privacy story than
-- reading a whole shared inbox.
--
-- projects.email_code (added for the Gmail "+" tag) is reused as the
-- Outlook category name too — one code per project, either mechanism.

-- Cc'd staff who each tag their own copy of the same email would otherwise
-- each independently sync it, double-recording the same event. Every
-- recipient's copy of one email shares the same RFC 5322 Message-ID
-- (Graph's internetMessageId), so that — not Graph's per-mailbox message id
-- — is the dedup key.
CREATE TABLE public.project_outlook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.connected_inboxes(id) ON DELETE SET NULL,
  internet_message_id text NOT NULL,
  ms_message_id text NOT NULL,
  subject text,
  from_address text,
  received_at timestamptz,
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'failed')),
  parsed_at timestamptz,
  activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, project_id, internet_message_id)
);

CREATE INDEX project_outlook_events_project_idx ON public.project_outlook_events(project_id);

ALTER TABLE public.project_outlook_events ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.project_outlook_events TO authenticated;
GRANT ALL ON public.project_outlook_events TO service_role;

CREATE POLICY "Company members can view their company's Outlook sync events"
  ON public.project_outlook_events FOR SELECT TO authenticated
  USING (public.is_company_member(company_id));
