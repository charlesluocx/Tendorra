"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId, getCurrentMembership } from "@/lib/company";
import { runGmailSync } from "@/lib/sync/gmail-sync";
import { runOutlookCategorySync } from "@/lib/sync/outlook-category-sync";

export type SyncState = { error: string | null; result: string | null };

// Runs the same sync a scheduled cron job would, scoped to just the caller's
// own company/connection — lets "Sync now" work in local dev, where nothing
// calls the GitHub Actions-scheduled cron routes.
export async function syncGmailNow(_prevState: SyncState): Promise<SyncState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", result: null };

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only an owner or admin can trigger a sync.", result: null };
  }

  const companyId = await getCurrentCompanyId(supabase);
  try {
    const { messagesProcessed } = await runGmailSync(companyId);
    revalidatePath("/settings/inbox");
    return {
      error: null,
      result: messagesProcessed === 0 ? "No new emails found." : `Synced ${messagesProcessed} new email${messagesProcessed === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed.", result: null };
  }
}

export async function syncOutlookNow(_prevState: SyncState): Promise<SyncState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in.", result: null };

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("connected_inboxes")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "microsoft")
    .eq("status", "connected")
    .maybeSingle();
  if (!connection) return { error: "Connect your Outlook inbox first.", result: null };

  try {
    const { messagesProcessed } = await runOutlookCategorySync(connection.id);
    revalidatePath("/settings/inbox");
    return {
      error: null,
      result: messagesProcessed === 0 ? "No newly categorized emails found." : `Synced ${messagesProcessed} new email${messagesProcessed === 1 ? "" : "s"}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Sync failed.", result: null };
  }
}

export async function disconnectGmailInbox() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) return;

  const companyId = await getCurrentCompanyId(supabase);
  const admin = createAdminClient();
  await admin
    .from("company_gmail_inbox")
    .update({ status: "disconnected", access_token: null, refresh_token: null })
    .eq("company_id", companyId);

  revalidatePath("/settings/inbox");
}

export async function disconnectInbox(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Service role for the write (tokens are otherwise unreadable/unwritable by
  // `authenticated`), but only after confirming this connection is the
  // caller's own.
  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("connected_inboxes")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!connection || connection.user_id !== user.id) return;

  await admin
    .from("connected_inboxes")
    .update({ status: "disconnected", access_token: null, refresh_token: null })
    .eq("id", id);

  revalidatePath("/settings/inbox");
}
