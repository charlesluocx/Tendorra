import { NextResponse, type NextRequest } from "next/server";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { getMicrosoftAuthorizeUrl } from "@/lib/microsoft-graph";

// Kicks off the Microsoft OAuth flow so a staff member can connect their own
// Outlook inbox. The state token is stored in a short-lived cookie and
// re-checked in the callback to prevent CSRF.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/auth/microsoft/callback", request.url).toString();

  const response = NextResponse.redirect(getMicrosoftAuthorizeUrl(redirectUri, state));
  response.cookies.set("ms_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
