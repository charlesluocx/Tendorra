-- Removes the Gmail/Outlook OAuth-based email sync (too much per-company
-- setup friction: Azure/Google app registrations, consent screens, cron
-- timing) in favour of a simpler drag-and-drop .eml/.msg upload, scoped to
-- whichever project page the file is dropped on — no OAuth, no code
-- matching, no scheduled job.

DROP TABLE IF EXISTS public.project_outlook_events CASCADE;
DROP TABLE IF EXISTS public.project_email_events CASCADE;
DROP TABLE IF EXISTS public.company_gmail_inbox CASCADE;
DROP TABLE IF EXISTS public.tagged_emails CASCADE;
DROP TABLE IF EXISTS public.connected_inboxes CASCADE;

ALTER TABLE public.projects DROP COLUMN IF EXISTS email_code;

-- Cc'd staff dragging in the same email would otherwise double-record it —
-- every recipient's copy shares one RFC 5322 Message-ID, so that's the
-- dedup key here too, same as the sync it replaces.
CREATE TABLE public.project_email_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  internet_message_id text,
  file_name text,
  subject text,
  from_address text,
  received_at timestamptz,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  parse_status text NOT NULL DEFAULT 'pending' CHECK (parse_status IN ('pending', 'parsed', 'failed')),
  parsed_at timestamptz,
  activity_id uuid REFERENCES public.activity_log(id) ON DELETE SET NULL
);

CREATE INDEX project_email_uploads_project_idx ON public.project_email_uploads(project_id);
CREATE UNIQUE INDEX project_email_uploads_project_internet_message_id_idx
  ON public.project_email_uploads (project_id, internet_message_id)
  WHERE internet_message_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.project_email_uploads TO authenticated;
GRANT ALL ON public.project_email_uploads TO service_role;
ALTER TABLE public.project_email_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage company email uploads"
  ON public.project_email_uploads FOR ALL TO authenticated
  USING (public.is_company_member(company_id))
  WITH CHECK (public.is_company_member(company_id));

CREATE TRIGGER set_company_id_before_insert
  BEFORE INSERT ON public.project_email_uploads
  FOR EACH ROW EXECUTE FUNCTION public.set_company_id_from_project();
