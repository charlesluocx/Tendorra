"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractBranding } from "@/lib/branding/extract";
import { uniqueSlug } from "@/lib/slug";

export type SignupState = { error: string | null };

export async function createCompanyAndOwner(
  _prevState: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const companyName = String(formData.get("company_name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim();

  if (!fullName || !email || !companyName) {
    return { error: "Name, email, and company name are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const supabase = await createClient();
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? "Could not create your account." };
  }

  // Best-effort: a slow or unreachable site should never block signup.
  const branding = website
    ? await extractBranding(website)
    : { logoUrl: null, primaryColor: null, secondaryColor: null };

  const admin = createAdminClient();
  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({
      name: companyName,
      slug: uniqueSlug(companyName),
      plan: "trial",
      website: website || null,
      logo_url: branding.logoUrl,
      brand_primary: branding.primaryColor,
      brand_secondary: branding.secondaryColor,
    })
    .select("id")
    .single();

  if (companyError || !company) {
    return { error: companyError?.message ?? "Could not create your company." };
  }

  const { error: membershipError } = await admin.from("company_users").insert({
    company_id: company.id,
    user_id: signUpData.user.id,
    role: "owner",
  });
  if (membershipError) {
    return { error: membershipError.message };
  }

  // If email confirmation is required, signUp doesn't establish a session
  // and the user isn't authenticated yet.
  if (!signUpData.session) {
    redirect("/signup/check-email");
  }

  redirect("/projects");
}
