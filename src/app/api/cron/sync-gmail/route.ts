import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidGmailAccessToken, listRecentMessageIds, getMessage, extractProjectCode } from "@/lib/gmail";
import { parseEmailWithAI } from "@/lib/ai/parse-email";

// First sync for a newly connected inbox only looks back this far, so
// connecting doesn't suddenly ingest years of old mail.
const INITIAL_LOOKBACK_DAYS = 2;
const MAX_MESSAGES_PER_RUN = 50;

// Triggered on a schedule by .github/workflows/sync-gmail.yml, same pattern
// as /api/cron/stale-reminders. Protected by CRON_SECRET since it acts
// across every company's shared Gmail inbox with the service-role client.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: inboxes, error: inboxError } = await supabase
    .from("company_gmail_inbox")
    .select("id, company_id, access_token, refresh_token, token_expires_at, last_synced_at")
    .eq("status", "connected");
  if (inboxError) return NextResponse.json({ error: inboxError.message }, { status: 500 });
  if (!inboxes || inboxes.length === 0) {
    return NextResponse.json({ companiesSynced: 0, messagesProcessed: 0 });
  }

  let messagesProcessed = 0;

  for (const inbox of inboxes) {
    try {
      const accessToken = await getValidGmailAccessToken(inbox);

      const query = inbox.last_synced_at
        ? `after:${Math.floor(new Date(inbox.last_synced_at).getTime() / 1000)}`
        : `newer_than:${INITIAL_LOOKBACK_DAYS}d`;
      const messageIds = await listRecentMessageIds(accessToken, query, MAX_MESSAGES_PER_RUN);

      if (messageIds.length > 0) {
        const { data: alreadySeen } = await supabase
          .from("project_email_events")
          .select("gmail_message_id")
          .eq("company_id", inbox.company_id)
          .in("gmail_message_id", messageIds);
        const seenIds = new Set((alreadySeen ?? []).map((r) => r.gmail_message_id));
        const newIds = messageIds.filter((id) => !seenIds.has(id));

        const { data: projects } = await supabase
          .from("projects")
          .select("id, email_code")
          .eq("company_id", inbox.company_id);
        const projectByCode = new Map((projects ?? []).map((p) => [p.email_code, p.id]));

        for (const messageId of newIds) {
          await processMessage(supabase, inbox.company_id, accessToken, messageId, projectByCode);
          messagesProcessed += 1;
        }
      }

      await supabase.from("company_gmail_inbox").update({ last_synced_at: new Date().toISOString() }).eq("id", inbox.id);
    } catch (err) {
      await supabase
        .from("company_gmail_inbox")
        .update({ status: "error" })
        .eq("id", inbox.id);
      console.error(`Gmail sync failed for company ${inbox.company_id}:`, err);
    }
  }

  return NextResponse.json({ companiesSynced: inboxes.length, messagesProcessed });
}

async function processMessage(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  accessToken: string,
  messageId: string,
  projectByCode: Map<string, string>,
) {
  const message = await getMessage(accessToken, messageId);
  const code = extractProjectCode(message);
  const projectId = code ? (projectByCode.get(code) ?? null) : null;

  if (!projectId) {
    await supabase.from("project_email_events").insert({
      company_id: companyId,
      project_id: null,
      gmail_message_id: messageId,
      subject: message.subject,
      from_address: message.from,
      received_at: message.receivedAt,
      parse_status: "unmatched",
    });
    return;
  }

  const { data: event } = await supabase
    .from("project_email_events")
    .insert({
      company_id: companyId,
      project_id: projectId,
      gmail_message_id: messageId,
      subject: message.subject,
      from_address: message.from,
      received_at: message.receivedAt,
      parse_status: "pending",
    })
    .select("id")
    .single();
  if (!event) return;

  try {
    const parsed = await parseEmailWithAI({
      subject: message.subject,
      from: message.from,
      receivedAt: message.receivedAt,
      body: message.body,
    });

    await supabase.from("ai_usage_log").insert({
      company_id: companyId,
      project_id: projectId,
      feature: "email_parse",
      source_id: event.id,
      model: parsed.usage.model,
      input_tokens: parsed.usage.inputTokens,
      output_tokens: parsed.usage.outputTokens,
    });

    const { data: activity } = await supabase
      .from("activity_log")
      .insert({
        company_id: companyId,
        project_id: projectId,
        source_type: "email",
        source_id: event.id,
        summary: parsed.summary,
        commitments: parsed.commitments,
        key_dates: parsed.key_dates,
        occurred_at: message.receivedAt ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    await supabase
      .from("project_email_events")
      .update({
        parse_status: "parsed",
        parsed_at: new Date().toISOString(),
        activity_id: activity?.id ?? null,
      })
      .eq("id", event.id);
  } catch (err) {
    await supabase.from("project_email_events").update({ parse_status: "failed" }).eq("id", event.id);
    console.error(`Failed to parse Gmail message ${messageId}:`, err);
  }
}
