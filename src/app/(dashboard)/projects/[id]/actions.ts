"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId, getCurrentMembership } from "@/lib/company";
import { runGmailSync } from "@/lib/sync/gmail-sync";
import { runOutlookCategorySync } from "@/lib/sync/outlook-category-sync";
import type { SyncState } from "@/app/(dashboard)/settings/inbox/actions";

export type FormState = { error: string | null };
const emptyState: FormState = { error: null };

// Runs whichever email sync(s) the caller can trigger — the company's
// shared Gmail inbox (owner/admin only) and/or their own connected Outlook
// (category sync) — scoped so this works from a project page without a
// trip to /settings/inbox.
export async function syncProjectEmailsNow(_prevState: SyncState, formData: FormData): Promise<SyncState> {
  const projectId = String(formData.get("project_id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", result: null };

  const companyId = await getCurrentCompanyId(supabase);
  const membership = await getCurrentMembership(supabase, user.id);
  const admin = createAdminClient();

  try {
    let messagesProcessed = 0;

    if (membership && ["owner", "admin"].includes(membership.role)) {
      const { data: gmailInbox } = await admin
        .from("company_gmail_inbox")
        .select("id")
        .eq("company_id", companyId)
        .eq("status", "connected")
        .maybeSingle();
      if (gmailInbox) {
        messagesProcessed += (await runGmailSync(companyId)).messagesProcessed;
      }
    }

    const { data: connection } = await admin
      .from("connected_inboxes")
      .select("id")
      .eq("user_id", user.id)
      .eq("provider", "microsoft")
      .eq("status", "connected")
      .maybeSingle();
    if (connection) {
      messagesProcessed += (await runOutlookCategorySync(connection.id)).messagesProcessed;
    }

    revalidatePath(`/projects/${projectId}`);
    return {
      error: null,
      result: messagesProcessed === 0 ? "No new emails found." : `Synced ${messagesProcessed} new email${messagesProcessed === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed.", result: null };
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
