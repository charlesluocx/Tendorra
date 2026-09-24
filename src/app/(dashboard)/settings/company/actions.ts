"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { extractBranding } from "@/lib/branding/extract";

export type CompanySettingsState = { error: string | null; success?: boolean };

export async function updateCompanySettings(
  _prevState: CompanySettingsState,
  formData: FormData,
): Promise<CompanySettingsState> {
  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();
  const staleAfterDaysRaw = String(formData.get("stale_after_days") ?? "");
  const staleAfterDays = Number(staleAfterDaysRaw);
  const currentWebsite = String(formData.get("current_website") ?? "").trim();

  if (!name) return { error: "Company name is required." };
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1) {
    return { error: "Gone-quiet threshold must be a whole number of days, at least 1." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return { error: "Only owners and admins can change company settings." };
  }

  // Best-effort, same as at signup: only re-fetch branding when the website
  // actually changed, and never let a slow/unreachable site block saving.
  const branding =
    website && website !== currentWebsite
      ? await extractBranding(website)
      : { logoUrl: undefined, primaryColor: undefined, secondaryColor: undefined };

  const { error } = await supabase
    .from("companies")
    .update({
      name,
      website: website || null,
      stale_after_days: staleAfterDays,
      ...(branding.logoUrl !== undefined ? { logo_url: branding.logoUrl } : {}),
      ...(branding.primaryColor !== undefined ? { brand_primary: branding.primaryColor } : {}),
      ...(branding.secondaryColor !== undefined ? { brand_secondary: branding.secondaryColor } : {}),
    })
    .eq("id", membership.companyId);

  if (error) return { error: error.message };

  revalidatePath("/settings/company");
  revalidatePath("/", "layout");
  return { error: null, success: true };
}
