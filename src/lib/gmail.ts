import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";
const SCOPES = "openid email https://www.googleapis.com/auth/gmail.readonly";

export function getGoogleAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  // access_type=offline + prompt=consent guarantee a refresh_token even if
  // this Google account has authorized the app before.
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
};

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getGmailProfile(accessToken: string): Promise<{ emailAddress: string }> {
  const res = await fetch(`${GMAIL_BASE}/users/me/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail profile lookup failed: ${await res.text()}`);
  return res.json();
}

// Mirrors getValidAccessToken in microsoft-graph.ts, but targets the single
// shared company_gmail_inbox row instead of a per-user connected_inboxes row.
export async function getValidGmailAccessToken(inbox: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}): Promise<string> {
  const expiresAt = inbox.token_expires_at ? new Date(inbox.token_expires_at).getTime() : 0;
  const stillValid = inbox.access_token && expiresAt - Date.now() > 60_000;
  if (stillValid) return inbox.access_token!;

  if (!inbox.refresh_token) throw new Error("Gmail connection has no refresh token; reconnect required.");

  const tokens = await refreshTokens(inbox.refresh_token);
  const admin = createAdminClient();
  await admin
    .from("company_gmail_inbox")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? inbox.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      status: "connected",
    })
    .eq("id", inbox.id);

  return tokens.access_token;
}

export async function listRecentMessageIds(accessToken: string, query: string, maxResults = 50): Promise<string[]> {
  const url = new URL(`${GMAIL_BASE}/users/me/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail list messages failed: ${await res.text()}`);
  const data = await res.json();
  return (data.messages ?? []).map((m: { id: string }) => m.id);
}

type GmailHeader = { name: string; value: string };
type GmailPart = {
  mimeType: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

export type GmailMessage = {
  id: string;
  subject: string | null;
  from: string | null;
  to: string | null;
  cc: string | null;
  receivedAt: string | null;
  body: string;
};

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

function findTextPart(part: GmailPart): string | null {
  if (part.mimeType === "text/plain" && part.body?.data) return decodeBase64Url(part.body.data);
  for (const child of part.parts ?? []) {
    const found = findTextPart(child);
    if (found) return found;
  }
  if (part.mimeType === "text/html" && part.body?.data) return decodeBase64Url(part.body.data);
  return null;
}

export async function getMessage(accessToken: string, messageId: string): Promise<GmailMessage> {
  const url = new URL(`${GMAIL_BASE}/users/me/messages/${encodeURIComponent(messageId)}`);
  url.searchParams.set("format", "full");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail get message failed: ${await res.text()}`);
  const data = await res.json();

  const headers: GmailHeader[] = data.payload?.headers ?? [];
  const header = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

  return {
    id: data.id,
    subject: header("Subject"),
    from: header("From"),
    to: header("To"),
    cc: header("Cc"),
    receivedAt: header("Date") ? new Date(header("Date")!).toISOString() : null,
    body: (data.payload ? findTextPart(data.payload) : null) ?? data.snippet ?? "",
  };
}

// A project's inbound address is <anything>+<CODE>@<domain> — pulls the
// first +tag found across To/Cc, matched case-insensitively against
// projects.email_code.
export function extractProjectCode(message: { to: string | null; cc: string | null }): string | null {
  const haystack = `${message.to ?? ""} ${message.cc ?? ""}`;
  const match = haystack.match(/\+([a-zA-Z0-9]+)@/);
  return match ? match[1]!.toUpperCase() : null;
}
