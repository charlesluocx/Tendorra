-- Stale-project reminders: track when we last emailed a company's
-- owners/admins about a project that's gone quiet, so a scheduled job can
-- avoid re-sending on every run. NULL means "never reminded".
ALTER TABLE public.projects
  ADD COLUMN last_reminder_sent_at timestamptz;
