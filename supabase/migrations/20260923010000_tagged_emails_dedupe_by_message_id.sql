-- Cc'd staff members each see their own copy of the same email and could
-- each tag it, previously creating two separate tagged_emails rows and two
-- separate activity_log entries — the same email double-recorded on the
-- timeline. Every recipient's copy shares one RFC 5322 Message-ID (Graph's
-- internetMessageId), so that's the cross-recipient dedup key.
ALTER TABLE public.tagged_emails ADD COLUMN internet_message_id text;

CREATE UNIQUE INDEX tagged_emails_project_internet_message_id_idx
  ON public.tagged_emails (project_id, internet_message_id)
  WHERE internet_message_id IS NOT NULL;
