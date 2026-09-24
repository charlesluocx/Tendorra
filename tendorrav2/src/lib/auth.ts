import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "admin" | "member";

export type Org = {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  plan: string;
  created_at: string;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  is_platform_admin: boolean;
};

export const getSessionUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_platform_admin")
    .eq("id", user.id)
    .single();
  return data;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  return profile;
}

export const getMyOrgs = cache(async () => {
  const user = await getSessionUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, organizations!inner(id, name, slug, status, plan, created_at)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  return (data ?? []).map((m) => ({
    role: m.role as OrgRole,
    org: m.organizations as unknown as Org,
  }));
});

/** Resolve the org in the URL and the caller's role in it; 404 if not a member. */
export const requireOrg = cache(async (slug: string) => {
  const profile = await requireProfile();
  const orgs = await getMyOrgs();
  const match = orgs.find((o) => o.org.slug === slug);
  if (!match) notFound();
  if (match.org.status === "suspended") redirect(`/suspended?org=${encodeURIComponent(match.org.name)}`);
  return {
    profile,
    org: match.org,
    role: match.role,
    isAdmin: match.role === "owner" || match.role === "admin",
  };
});

export async function requirePlatformAdmin() {
  const profile = await requireProfile();
  if (!profile.is_platform_admin) notFound();
  return profile;
}

/** 404 unless the organization has this tool switched on. */
export async function requireTool(orgId: string, toolKey: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("org_tools")
    .select("enabled")
    .eq("org_id", orgId)
    .eq("tool_key", toolKey)
    .maybeSingle();
  if (!data?.enabled) notFound();
}
