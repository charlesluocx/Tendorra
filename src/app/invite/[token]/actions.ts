"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AcceptInviteState = { error: string | null };

export async function acceptInvite(
  _prevState: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const token = String(formData.get("token") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Enter your name." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const admin = createAdminClient();
  const { data: invite, error: inviteError } = await admin
    .from("company_invites")
    .select("id, company_id, email, role, status")
    .eq("token", token)
    .maybeSingle();

  if (inviteError || !invite || invite.status !== "pending") {
    return { error: "This invite link is no longer valid." };
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "Could not create your account." };
  }

  const { error: membershipError } = await admin.from("company_users").insert({
    company_id: invite.company_id,
    user_id: signUpData.user.id,
    role: invite.role,
  });
  if (membershipError) return { error: membershipError.message };

  await admin
    .from("company_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  if (!signUpData.session) {
    redirect("/signup/check-email");
  }

  redirect("/projects");
}
