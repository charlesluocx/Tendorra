import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { getGoogleAuthorizeUrl } from "@/lib/gmail";

// Kicks off the Google OAuth flow to connect the company's one shared
// project-timeline Gmail inbox. Owner/admin only — unlike the per-staff
// Outlook connection, this is a single company-wide credential.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const membership = await getCurrentMembership(supabase, user.id);
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    const settingsUrl = new URL("/settings/inbox", request.url);
    settingsUrl.searchParams.set("error", "Only owners and admins can connect the project-timeline inbox.");
    return NextResponse.redirect(settingsUrl);
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/auth/gmail/callback", request.url).toString();

  const response = NextResponse.redirect(getGoogleAuthorizeUrl(redirectUri, state));
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
