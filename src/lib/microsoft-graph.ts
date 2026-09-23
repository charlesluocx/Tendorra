import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

const TENANT = process.env.MICROSOFT_TENANT_ID || "common";
const AUTHORIZE_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/authorize`;
const TOKEN_URL = `https://login.microsoftonline.com/${TENANT}/oauth2/v2.0/token`;
const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
const SCOPES = "openid profile email offline_access User.Read Mail.Read";

export function getMicrosoftAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.MICROSOFT_CLIENT_ID!);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
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
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Microsoft token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getGraphMe(accessToken: string): Promise<{ mail: string | null; userPrincipalName: string }> {
  const res = await fetch(`${GRAPH_BASE}/me?$select=mail,userPrincipalName`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Microsoft Graph /me failed: ${await res.text()}`);
  return res.json();
}

export type GraphMessage = {
  id: string;
  internetMessageId: string;
  subject: string | null;
  from: { emailAddress: { address: string; name: string } } | null;
  receivedDateTime: string;
  bodyPreview: string;
};

// Returns a usable access token for a connected_inboxes row, refreshing and
// persisting it first if it has expired. Callers already hold the row's
// tokens (fetched via the service-role client, never sent to the browser).
export async function getValidAccessToken(connection: {
  id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
}): Promise<string> {
  const expiresAt = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  const stillValid = connection.access_token && expiresAt - Date.now() > 60_000;
  if (stillValid) return connection.access_token!;

  if (!connection.refresh_token) throw new Error("Inbox connection has no refresh token; reconnect required.");

  const tokens = await refreshTokens(connection.refresh_token);
  const admin = createAdminClient();
  await admin
    .from("connected_inboxes")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? connection.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      status: "connected",
    })
    .eq("id", connection.id);

  return tokens.access_token;
}

export async function listRecentMessages(accessToken: string, top = 25): Promise<GraphMessage[]> {
  const url = `${GRAPH_BASE}/me/messages?$top=${top}&$orderby=receivedDateTime desc&$select=id,internetMessageId,subject,from,receivedDateTime,bodyPreview`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Microsoft Graph list messages failed: ${await res.text()}`);
  const data = await res.json();
  return data.value ?? [];
}

export async function getMessageBody(accessToken: string, messageId: string): Promise<string> {
  const url = `${GRAPH_BASE}/me/messages/${encodeURIComponent(messageId)}?$select=body`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Microsoft Graph get message failed: ${await res.text()}`);
  const data = await res.json();
  return data.body?.content ?? "";
}

export type GraphMessageStub = {
  id: string;
  internetMessageId: string;
  subject: string | null;
  from: { emailAddress: { address: string; name: string } } | null;
  receivedDateTime: string;
};

// Category filters use the `any()` lambda operator on a multi-value
// property, which Graph only supports as an "advanced query" — hence the
// ConsistencyLevel header and $count param below, even though we don't use
// the count itself. Never fetches messages outside this exact category, so
// nothing untagged is read at all — the point of tagging by category
// instead of syncing a whole inbox.
export async function listMessagesByCategory(
  accessToken: string,
  category: string,
  top = 50,
): Promise<GraphMessageStub[]> {
  const escaped = category.replace(/'/g, "''");
  const url = new URL(`${GRAPH_BASE}/me/messages`);
  url.searchParams.set("$filter", `categories/any(c:c eq '${escaped}')`);
  url.searchParams.set("$select", "id,internetMessageId,subject,from,receivedDateTime");
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$top", String(top));
  url.searchParams.set("$count", "true");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, ConsistencyLevel: "eventual" },
  });
  if (!res.ok) throw new Error(`Microsoft Graph list messages by category failed: ${await res.text()}`);
  const data = await res.json();
  return data.value ?? [];
}
