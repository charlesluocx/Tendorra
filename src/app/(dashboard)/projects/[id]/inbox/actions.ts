"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/company";
import { getValidAccessToken, getMessageBody } from "@/lib/microsoft-graph";
import { parseEmailWithAI } from "@/lib/ai/parse-email";

export type TagEmailState = { error: string | null };
const emptyState: TagEmailState = { error: null };

export async function tagEmail(_prevState: TagEmailState, formData: FormData): Promise<TagEmailState> {
  const projectId = String(formData.get("project_id") ?? "");
  const connectionId = String(formData.get("connection_id") ?? "");
  const messageId = String(formData.get("message_id") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const fromAddress = String(formData.get("from_address") ?? "");
  const receivedAt = String(formData.get("received_at") ?? "");
  const bodyPreview = String(formData.get("body_preview") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const companyId = await getCurrentCompanyId(supabase);

  const { data: tagged, error } = await supabase
    .from("tagged_emails")
    .insert({
      company_id: companyId,
      project_id: projectId,
      connection_id: connectionId,
      ms_message_id: messageId,
      subject: subject || null,
      from_address: fromAddress || null,
      received_at: receivedAt || null,
      body_preview: bodyPreview || null,
      tagged_by: user.id,
    })
    .select("id")
    .single();

  if (error || !tagged) {
    return { error: error?.message ?? "Could not tag that email." };
  }

  revalidatePath(`/projects/${projectId}`);

  // Parse inline rather than queueing a background job — Phase 1 has no
  // job runner. A failure here leaves the email tagged with parse_status
  // 'failed' rather than losing the tag.
  try {
    await parseTaggedEmail(tagged.id);
  } catch (err) {
    const admin = createAdminClient();
    await admin.from("tagged_emails").update({ parse_status: "failed" }).eq("id", tagged.id);
    return { error: err instanceof Error ? `Tagged, but parsing failed: ${err.message}` : "Tagged, but parsing failed." };
  }

  revalidatePath(`/projects/${projectId}`);
  return emptyState;
}

async function parseTaggedEmail(taggedEmailId: string) {
  const admin = createAdminClient();

  const { data: tagged, error: taggedError } = await admin
    .from("tagged_emails")
    .select("id, company_id, project_id, connection_id, ms_message_id, subject, from_address, received_at, tagged_by")
    .eq("id", taggedEmailId)
    .single();
  if (taggedError || !tagged || !tagged.connection_id) throw new Error("Tagged email not found.");

  const { data: connection, error: connectionError } = await admin
    .from("connected_inboxes")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("id", tagged.connection_id)
    .single();
  if (connectionError || !connection) throw new Error("Inbox connection not found.");

  const accessToken = await getValidAccessToken(connection);
  const body = await getMessageBody(accessToken, tagged.ms_message_id);
  const parsed = await parseEmailWithAI({
    subject: tagged.subject,
    from: tagged.from_address,
    receivedAt: tagged.received_at,
    body,
  });

  await admin.from("ai_usage_log").insert({
    company_id: tagged.company_id,
    project_id: tagged.project_id,
    user_id: tagged.tagged_by,
    feature: "email_parse",
    source_id: tagged.id,
    model: parsed.usage.model,
    input_tokens: parsed.usage.inputTokens,
    output_tokens: parsed.usage.outputTokens,
  });

  const { data: activity, error: activityError } = await admin
    .from("activity_log")
    .insert({
      company_id: tagged.company_id,
      project_id: tagged.project_id,
      source_type: "email",
      source_id: tagged.id,
      summary: parsed.summary,
      commitments: parsed.commitments,
      key_dates: parsed.key_dates,
      occurred_at: tagged.received_at ?? new Date().toISOString(),
    })
    .select("id")
    .single();
  if (activityError || !activity) throw new Error(activityError?.message ?? "Could not save activity entry.");

  await admin
    .from("tagged_emails")
    .update({ parse_status: "parsed", parsed_at: new Date().toISOString(), activity_id: activity.id })
    .eq("id", tagged.id);
}
