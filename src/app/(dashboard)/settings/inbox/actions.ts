"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId, getCurrentMembership } from "@/lib/company";

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
