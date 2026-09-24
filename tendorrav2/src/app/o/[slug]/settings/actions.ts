"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth";
import { getTool } from "@/lib/tools/registry";
import type { FormState } from "@/components/form-message";

async function requireOrgAdmin(slug: string) {
  const ctx = await requireOrg(slug);
  if (!ctx.isAdmin) throw new Error("Only workspace admins can do that.");
  return ctx;
}

export async function renameOrg(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { org } = await requireOrgAdmin(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Name is too short." };
  const supabase = await createClient();
  const { error } = await supabase.from("organizations").update({ name }).eq("id", org.id);
  if (error) return { error: error.message };
  revalidatePath(`/o/${slug}`, "layout");
  return { success: "Saved." };
}

export type InviteState = { error?: string; success?: string; link?: string } | undefined;

export async function inviteMember(slug: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const { org, profile } = await requireOrgAdmin(slug);
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email"), role: z.enum(["admin", "member"]) })
    .safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ org_id: org.id, email: parsed.data.email, role: parsed.data.role, invited_by: profile.id })
    .select("token")
    .single();
  if (error) return { error: error.message };

  await supabase.from("activity_log").insert({
    org_id: org.id,
    user_id: profile.id,
    action: "member.invited",
    entity_type: "invitation",
    meta: { email: parsed.data.email, role: parsed.data.role },
  });

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  revalidatePath(`/o/${slug}/settings`);
  return { success: `Invitation created for ${parsed.data.email}. Send them this link:`, link: `${origin}/invite/${data.token}` };
}

export async function revokeInvite(slug: string, inviteId: string) {
  const { org } = await requireOrgAdmin(slug);
  const supabase = await createClient();
  await supabase.from("invitations").delete().eq("id", inviteId).eq("org_id", org.id);
  revalidatePath(`/o/${slug}/settings`);
}

export async function changeRole(slug: string, userId: string, role: "admin" | "member") {
  const { org } = await requireOrgAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").update({ role }).eq("org_id", org.id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/o/${slug}/settings`);
}

export async function removeMember(slug: string, userId: string) {
  const { org, profile } = await requireOrgAdmin(slug);
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("org_id", org.id).eq("user_id", userId);
  if (error) throw new Error(error.message);
  await supabase.from("activity_log").insert({
    org_id: org.id,
    user_id: profile.id,
    action: "member.removed",
    entity_type: "user",
    entity_id: userId,
  });
  revalidatePath(`/o/${slug}/settings`);
}

export async function toggleTool(slug: string, toolKey: string, enabled: boolean) {
  const { org } = await requireOrgAdmin(slug);
  const tool = getTool(toolKey);
  if (!tool || tool.status !== "live") throw new Error("Unknown tool");
  const supabase = await createClient();
  const { error } = await supabase.from("org_tools").upsert({ org_id: org.id, tool_key: toolKey, enabled });
  if (error) throw new Error(error.message);
  revalidatePath(`/o/${slug}`, "layout");
}
