"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth";
import { CATEGORIES } from "@/lib/timeline";
import type { FormState } from "@/components/form-message";

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null));

const ProjectInput = z.object({
  name: z.string().trim().min(1, "Project name is required").max(200),
  code: z.string().trim().max(50).optional().transform((v) => v || null),
  address: z.string().trim().max(300).optional().transform((v) => v || null),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  status: z.enum(["planning", "active", "on_hold", "completed", "archived"]).default("active"),
  start_date: optionalDate,
  target_end_date: optionalDate,
});

function formObject(formData: FormData) {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}

async function log(orgId: string, action: string, entityType: string, entityId: string | null, meta: object = {}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await supabase.from("activity_log").insert({
    org_id: orgId,
    user_id: user?.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta,
  });
}

export async function createProject(slug: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { org, profile } = await requireOrg(slug);
  const parsed = ProjectInput.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...parsed.data, org_id: org.id, created_by: profile.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  await log(org.id, "project.created", "project", data.id, { name: parsed.data.name });
  redirect(`/o/${slug}/timeline/${data.id}`);
}

export async function updateProject(slug: string, projectId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { org } = await requireOrg(slug);
  const parsed = ProjectInput.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update(parsed.data).eq("id", projectId).eq("org_id", org.id);
  if (error) return { error: error.message };
  await log(org.id, "project.updated", "project", projectId);
  revalidatePath(`/o/${slug}/timeline/${projectId}`);
  return { success: "Project saved." };
}

export async function deleteProject(slug: string, projectId: string) {
  const { org, isAdmin } = await requireOrg(slug);
  if (!isAdmin) throw new Error("Only workspace admins can delete projects.");
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("org_id", org.id);
  if (error) throw new Error(error.message);
  await log(org.id, "project.deleted", "project", projectId);
  redirect(`/o/${slug}/timeline`);
}

const ItemInput = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(300),
    summary: z.string().trim().max(4000).optional().transform((v) => v || null),
    occurred_at: z.string().min(1, "Date is required"),
    kind: z.enum(["event", "milestone"]),
    milestone_status: z.enum(["planned", "achieved", "missed"]).optional(),
    category: z.enum(CATEGORIES).default("other"),
  })
  .transform((v) => ({
    ...v,
    occurred_at: new Date(v.occurred_at).toISOString(),
    milestone_status: v.kind === "milestone" ? (v.milestone_status ?? "planned") : null,
  }));

export async function saveTimelineItem(
  slug: string,
  projectId: string,
  itemId: string | null,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { org, profile } = await requireOrg(slug);
  const parsed = ItemInput.safeParse(formObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (Number.isNaN(new Date(parsed.data.occurred_at).getTime())) return { error: "Invalid date" };

  const supabase = await createClient();
  if (itemId) {
    const { error } = await supabase
      .from("timeline_items")
      .update(parsed.data)
      .eq("id", itemId)
      .eq("org_id", org.id);
    if (error) return { error: error.message };
    await log(org.id, "timeline.updated", "timeline_item", itemId, { title: parsed.data.title });
  } else {
    const { data, error } = await supabase
      .from("timeline_items")
      .insert({ ...parsed.data, org_id: org.id, project_id: projectId, created_by: profile.id })
      .select("id")
      .single();
    if (error) return { error: error.message };
    await log(org.id, "timeline.created", "timeline_item", data.id, { title: parsed.data.title });
  }
  revalidatePath(`/o/${slug}/timeline/${projectId}`);
  return { success: "Saved." };
}

export async function deleteTimelineItem(slug: string, projectId: string, itemId: string) {
  const { org } = await requireOrg(slug);
  const supabase = await createClient();
  await supabase.from("timeline_items").delete().eq("id", itemId).eq("org_id", org.id);
  await log(org.id, "timeline.deleted", "timeline_item", itemId);
  revalidatePath(`/o/${slug}/timeline/${projectId}`);
}

export async function setMilestone(slug: string, projectId: string, itemId: string, status: "planned" | "achieved" | "missed" | null) {
  const { org } = await requireOrg(slug);
  const supabase = await createClient();
  await supabase
    .from("timeline_items")
    .update(status ? { kind: "milestone", milestone_status: status } : { kind: "event", milestone_status: null })
    .eq("id", itemId)
    .eq("org_id", org.id);
  revalidatePath(`/o/${slug}/timeline/${projectId}`);
}

export async function deleteEmail(slug: string, projectId: string, emailId: string, withItems: boolean) {
  const { org } = await requireOrg(slug);
  const supabase = await createClient();
  const { data: email } = await supabase.from("emails").select("storage_path").eq("id", emailId).eq("org_id", org.id).single();
  if (withItems) await supabase.from("timeline_items").delete().eq("email_id", emailId).eq("org_id", org.id);
  await supabase.from("emails").delete().eq("id", emailId).eq("org_id", org.id);
  if (email?.storage_path) await supabase.storage.from("emails").remove([email.storage_path]);
  await log(org.id, "email.deleted", "email", emailId);
  revalidatePath(`/o/${slug}/timeline/${projectId}`);
}

export async function getEmailDownloadUrl(slug: string, emailId: string) {
  const { org } = await requireOrg(slug);
  const supabase = await createClient();
  const { data: email } = await supabase.from("emails").select("storage_path, file_name").eq("id", emailId).eq("org_id", org.id).single();
  if (!email?.storage_path) return null;
  const { data } = await supabase.storage.from("emails").createSignedUrl(email.storage_path, 60, { download: email.file_name ?? true });
  return data?.signedUrl ?? null;
}
