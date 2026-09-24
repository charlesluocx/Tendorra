"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/company";
import { parseEmailFile } from "@/lib/email-file-parser";
import { parseEmailWithAI } from "@/lib/ai/parse-email";

export type FormState = { error: string | null };
const emptyState: FormState = { error: null };

export type UploadState = { error: string | null; result: string | null };

const ALREADY_LOGGED_MESSAGE = "Already logged on this project (likely by a colleague who was cc'd) — not recorded twice.";

// Drag-and-drop alternative to OAuth-based email sync: reads a .eml or
// .msg file directly (dragged straight from Outlook desktop produces a
// .msg; Gmail's "Show original" or Outlook's "Save As" produce a .eml) and
// logs it to whichever project's page it was dropped on — no inbox
// connection, no code matching, no scheduled job.
export async function uploadEmailFile(_prevState: UploadState, formData: FormData): Promise<UploadState> {
  const projectId = String(formData.get("project_id") ?? "");
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No file received.", result: null };

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = await parseEmailFile(file.name, buffer);
  } catch (err) {
    return {
      error: err instanceof Error ? `Could not read that file: ${err.message}` : "Could not read that file.",
      result: null,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", result: null };
  const companyId = await getCurrentCompanyId(supabase);

  // Every recipient's copy of one email shares the same internetMessageId,
  // so this is the dedup key across cc'd staff dragging in the same email.
  if (parsed.internetMessageId) {
    const { data: existing } = await supabase
      .from("project_email_uploads")
      .select("id")
      .eq("project_id", projectId)
      .eq("internet_message_id", parsed.internetMessageId)
      .maybeSingle();
    if (existing) return { error: null, result: ALREADY_LOGGED_MESSAGE };
  }

  const { data: uploadRow, error: insertError } = await supabase
    .from("project_email_uploads")
    .insert({
      company_id: companyId,
      project_id: projectId,
      internet_message_id: parsed.internetMessageId,
      file_name: file.name,
      subject: parsed.subject,
      from_address: parsed.from,
      received_at: parsed.receivedAt,
      uploaded_by: user.id,
      parse_status: "pending",
    })
    .select("id")
    .single();

  if (insertError || !uploadRow) {
    // A unique-constraint hit means two uploads of the same email raced
    // past the check above — same outcome as catching it up front.
    if (insertError?.code === "23505") return { error: null, result: ALREADY_LOGGED_MESSAGE };
    return { error: insertError?.message ?? "Could not save that email.", result: null };
  }

  try {
    const ai = await parseEmailWithAI({
      subject: parsed.subject,
      from: parsed.from,
      receivedAt: parsed.receivedAt,
      body: parsed.body,
    });

    // ai_usage_log only grants INSERT to service_role.
    const admin = createAdminClient();
    await admin.from("ai_usage_log").insert({
      company_id: companyId,
      project_id: projectId,
      user_id: user.id,
      feature: "email_parse",
      source_id: uploadRow.id,
      model: ai.usage.model,
      input_tokens: ai.usage.inputTokens,
      output_tokens: ai.usage.outputTokens,
    });

    const { data: activity } = await supabase
      .from("activity_log")
      .insert({
        company_id: companyId,
        project_id: projectId,
        source_type: "email",
        source_id: uploadRow.id,
        summary: ai.summary,
        commitments: ai.commitments,
        key_dates: ai.key_dates,
        occurred_at: parsed.receivedAt ?? new Date().toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();

    await supabase
      .from("project_email_uploads")
      .update({ parse_status: "parsed", parsed_at: new Date().toISOString(), activity_id: activity?.id ?? null })
      .eq("id", uploadRow.id);

    revalidatePath(`/projects/${projectId}`);
    return { error: null, result: `Logged "${parsed.subject ?? file.name}" on the timeline.` };
  } catch (err) {
    await supabase.from("project_email_uploads").update({ parse_status: "failed" }).eq("id", uploadRow.id);
    revalidatePath(`/projects/${projectId}`);
    return {
      error: err instanceof Error ? `Saved, but parsing failed: ${err.message}` : "Saved, but parsing failed.",
      result: null,
    };
  }
}

export async function addCallNote(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const noteText = String(formData.get("note_text") ?? "").trim();
  const participants = String(formData.get("participants") ?? "").trim();
  const callDate = String(formData.get("call_date") ?? "").trim();

  if (!noteText) return { error: "Add a note before saving." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await getCurrentCompanyId(supabase);

  const { error } = await supabase.from("call_notes").insert({
    company_id: companyId,
    project_id: projectId,
    note_text: noteText,
    participants: participants || null,
    call_date: callDate ? new Date(callDate).toISOString() : new Date().toISOString(),
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return emptyState;
}

export async function addManualUpdate(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const summary = String(formData.get("summary") ?? "").trim();

  if (!summary) return { error: "Write an update before saving." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await getCurrentCompanyId(supabase);

  const { error } = await supabase.from("activity_log").insert({
    company_id: companyId,
    project_id: projectId,
    source_type: "manual",
    summary,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return emptyState;
}

export async function createActionItem(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const projectId = String(formData.get("project_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();

  if (!title) return { error: "Give the action item a title." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const companyId = await getCurrentCompanyId(supabase);

  const { error } = await supabase.from("action_items").insert({
    company_id: companyId,
    project_id: projectId,
    title,
    due_date: dueDate || null,
    created_by: user?.id ?? null,
  });

  if (error) return { error: error.message };

  revalidatePath(`/projects/${projectId}`);
  return emptyState;
}

export async function setActionItemStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const supabase = await createClient();
  await supabase.from("action_items").update({ status }).eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}

export async function setChecklistItemStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const status = String(formData.get("status") ?? "");

  const supabase = await createClient();
  await supabase
    .from("project_checklist_items")
    .update({ status, completed_at: status === "done" ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath(`/projects/${projectId}`);
}
