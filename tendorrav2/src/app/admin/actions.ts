"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth";
import { getTool } from "@/lib/tools/registry";

async function audit(adminId: string, action: string, orgId: string | null, entityType: string, entityId: string, meta: object = {}) {
  await createAdminClient().from("activity_log").insert({
    org_id: orgId,
    user_id: adminId,
    action,
    entity_type: entityType,
    entity_id: entityId,
    meta: { ...meta, by_platform_admin: true },
  });
}

export async function setOrgStatus(orgId: string, status: "active" | "suspended") {
  const admin = await requirePlatformAdmin();
  const { error } = await createAdminClient().from("organizations").update({ status }).eq("id", orgId);
  if (error) throw new Error(error.message);
  await audit(admin.id, `admin.organization.${status === "active" ? "reactivated" : "suspended"}`, orgId, "organization", orgId);
  revalidatePath("/admin", "layout");
}

export async function setOrgPlan(orgId: string, plan: string) {
  const admin = await requirePlatformAdmin();
  const clean = plan.trim().toLowerCase().slice(0, 30);
  if (!clean) throw new Error("Plan is required");
  const { error } = await createAdminClient().from("organizations").update({ plan: clean }).eq("id", orgId);
  if (error) throw new Error(error.message);
  await audit(admin.id, "admin.organization.plan_changed", orgId, "organization", orgId, { plan: clean });
  revalidatePath("/admin", "layout");
}

export async function setOrgTool(orgId: string, toolKey: string, enabled: boolean) {
  const admin = await requirePlatformAdmin();
  if (!getTool(toolKey)) throw new Error("Unknown tool");
  const { error } = await createAdminClient().from("org_tools").upsert({ org_id: orgId, tool_key: toolKey, enabled });
  if (error) throw new Error(error.message);
  await audit(admin.id, "admin.tool.toggled", orgId, "organization", orgId, { tool: toolKey, enabled });
  revalidatePath("/admin", "layout");
}

export async function setPlatformAdmin(userId: string, value: boolean) {
  const admin = await requirePlatformAdmin();
  if (userId === admin.id && !value) throw new Error("You can't remove your own admin access.");
  const { error } = await createAdminClient().from("profiles").update({ is_platform_admin: value }).eq("id", userId);
  if (error) throw new Error(error.message);
  await audit(admin.id, value ? "admin.user.promoted" : "admin.user.demoted", null, "user", userId);
  revalidatePath("/admin", "layout");
}
