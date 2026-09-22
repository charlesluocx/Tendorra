import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId, getCurrentMembership } from "@/lib/company";
import { exchangeCodeForTokens, getGmailProfile } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/inbox", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("gmail_oauth_state")?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    settingsUrl.searchParams.set("error", "Invalid or expired connection request. Please try again.");
    return NextResponse.redirect(settingsUrl);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const membership = await getCurrentMembership(supabase, user.id);
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only owners and admins can connect the project-timeline inbox.");
    }

    const redirectUri = new URL("/api/auth/gmail/callback", request.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const profile = await getGmailProfile(tokens.access_token);

    const companyId = await getCurrentCompanyId(supabase);
    const admin = createAdminClient();
    const { error } = await admin.from("company_gmail_inbox").upsert(
      {
        company_id: companyId,
        email_address: profile.emailAddress,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        connected_by: user.id,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "company_id" },
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    settingsUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Could not connect the project-timeline inbox.",
    );
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("gmail_oauth_state");
    return response;
  }

  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete("gmail_oauth_state");
  return response;
}
