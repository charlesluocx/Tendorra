"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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
