import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentCompanyId } from "@/lib/company";
import { exchangeCodeForTokens, getGraphMe } from "@/lib/microsoft-graph";

export async function GET(request: NextRequest) {
  const settingsUrl = new URL("/settings/inbox", request.url);

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get("ms_oauth_state")?.value;

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
    const redirectUri = new URL("/api/auth/microsoft/callback", request.url).toString();
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const me = await getGraphMe(tokens.access_token);
    const emailAddress = me.mail ?? me.userPrincipalName;

    const companyId = await getCurrentCompanyId(supabase);
    const admin = createAdminClient();
    const { error } = await admin.from("connected_inboxes").upsert(
      {
        company_id: companyId,
        user_id: user.id,
        provider: "microsoft",
        email_address: emailAddress,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        status: "connected",
        connected_at: new Date().toISOString(),
      },
      { onConflict: "company_id,user_id,provider" },
    );
    if (error) throw new Error(error.message);
  } catch (err) {
    settingsUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Could not connect your inbox.",
    );
    const response = NextResponse.redirect(settingsUrl);
    response.cookies.delete("ms_oauth_state");
    return response;
  }

  const response = NextResponse.redirect(settingsUrl);
  response.cookies.delete("ms_oauth_state");
  return response;
}
