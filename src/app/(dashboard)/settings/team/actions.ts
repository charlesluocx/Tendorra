"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { sendInviteEmail } from "@/lib/email/send-invite";

export type InviteState = { error: string | null; inviteUrl?: string; emailed?: boolean };

function makeToken() {
  return randomBytes(24).toString("hex");
}

export async function inviteEmployee(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "member");
  const origin = String(formData.get("origin") ?? "");

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };
  if (!["admin", "member"].includes(role)) return { error: "Invalid role." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only owners and admins can invite people." };
  }

  const token = makeToken();
  const { error } = await supabase.from("company_invites").insert({
    company_id: membership.companyId,
    email,
    role,
    token,
    invited_by: user.id,
  });

  if (error) {
    return {
      error: error.message.includes("company_invites_pending_email_idx")
        ? "There's already a pending invite for that email."
        : error.message,
    };
  }

  const inviteUrl = `${origin.replace(/\/$/, "")}/invite/${token}`;

  const [{ data: company }, { data: inviterProfile }] = await Promise.all([
    supabase.from("companies").select("name").eq("id", membership.companyId).single(),
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
  ]);

  const emailed = await sendInviteEmail({
    to: email,
    companyName: company?.name ?? "your company",
    inviterName: inviterProfile?.full_name || inviterProfile?.email || "A teammate",
    role,
    inviteUrl,
  });

  revalidatePath("/settings/team");
  return { error: null, inviteUrl, emailed };
}

export async function revokeInvite(formData: FormData) {
  const id = String(formData.get("id") ?? "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) return;

  await supabase.from("company_invites").update({ status: "revoked" }).eq("id", id);
  revalidatePath("/settings/team");
}

export async function updateMemberRole(formData: FormData) {
  const memberId = String(formData.get("member_id") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!["owner", "admin", "member"].includes(role)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) return;

  await supabase.from("company_users").update({ role }).eq("id", memberId);
  revalidatePath("/settings/team");
}
