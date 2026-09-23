import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getValidAccessToken, listMessagesByCategory, getMessageBody } from "@/lib/microsoft-graph";
import { parseEmailWithAI } from "@/lib/ai/parse-email";

const MESSAGES_PER_PROJECT = 50;

// Shared by /api/cron/sync-outlook-categories (every connected inbox, on a
// schedule) and the "Sync now" button in settings (one person's own
// connection, on demand). Never reads a whole inbox: listMessagesByCategory
// filters server-side on each project's email_code as an Outlook category.
export async function runOutlookCategorySync(connectionId?: string) {
  const supabase = createAdminClient();

  let query = supabase
    .from("connected_inboxes")
    .select("id, company_id, access_token, refresh_token, token_expires_at")
    .eq("provider", "microsoft")
    .eq("status", "connected");
  if (connectionId) query = query.eq("id", connectionId);
  const { data: connections, error: connectionsError } = await query;
  if (connectionsError) throw new Error(connectionsError.message);
  if (!connections || connections.length === 0) {
    return { connectionsSynced: 0, messagesProcessed: 0 };
  }

  let messagesProcessed = 0;

  for (const connection of connections) {
    try {
      const accessToken = await getValidAccessToken(connection);

      const { data: projects } = await supabase
        .from("projects")
        .select("id, email_code")
        .eq("company_id", connection.company_id);

      for (const project of projects ?? []) {
        const messages = await listMessagesByCategory(accessToken, project.email_code, MESSAGES_PER_PROJECT);
        if (messages.length === 0) continue;

        // Every recipient's copy of one email shares the same
        // internetMessageId, so this is the dedup key across cc'd staff —
        // not Graph's per-mailbox message id.
        const { data: alreadySeen } = await supabase
          .from("project_outlook_events")
          .select("internet_message_id")
          .eq("company_id", connection.company_id)
          .eq("project_id", project.id)
          .in(
            "internet_message_id",
            messages.map((m) => m.internetMessageId),
          );
        const seenIds = new Set((alreadySeen ?? []).map((r) => r.internet_message_id));
        const newMessages = messages.filter((m) => !seenIds.has(m.internetMessageId));

        for (const message of newMessages) {
          await processMessage(supabase, connection.company_id, connection.id, project.id, accessToken, message);
          messagesProcessed += 1;
        }
      }

      await supabase.from("connected_inboxes").update({ last_synced_at: new Date().toISOString() }).eq("id", connection.id);
    } catch (err) {
      console.error(`Outlook category sync failed for connection ${connection.id}:`, err);
    }
  }

  return { connectionsSynced: connections.length, messagesProcessed };
}

async function processMessage(
  supabase: ReturnType<typeof createAdminClient>,
  companyId: string,
  connectionId: string,
  projectId: string,
  accessToken: string,
  message: { id: string; internetMessageId: string; subject: string | null; from: { emailAddress: { address: string } } | null; receivedDateTime: string },
) {
  // Insert the dedup row before parsing: a concurrent run picking up the
  // same message (or a colleague's copy landing mid-loop) hits the unique
  // constraint instead of parsing and recording it a second time.
  const { data: event, error: insertError } = await supabase
    .from("project_outlook_events")
    .insert({
      company_id: companyId,
      project_id: projectId,
      connection_id: connectionId,
      internet_message_id: message.internetMessageId,
      ms_message_id: message.id,
      subject: message.subject,
      from_address: message.from?.emailAddress?.address ?? null,
      received_at: message.receivedDateTime,
      parse_status: "pending",
    })
    .select("id")
    .single();
  if (insertError || !event) return;

  try {
    const body = await getMessageBody(accessToken, message.id);
    const parsed = await parseEmailWithAI({
      subject: message.subject,
      from: message.from?.emailAddress?.address ?? null,
      receivedAt: message.receivedDateTime,
      body,
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
        occurred_at: message.receivedDateTime ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    await supabase
      .from("project_outlook_events")
      .update({
        parse_status: "parsed",
        parsed_at: new Date().toISOString(),
        activity_id: activity?.id ?? null,
      })
      .eq("id", event.id);
  } catch (err) {
    await supabase.from("project_outlook_events").update({ parse_status: "failed" }).eq("id", event.id);
    console.error(`Failed to parse Outlook message ${message.id}:`, err);
  }
}
