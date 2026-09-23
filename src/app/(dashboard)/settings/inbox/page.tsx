import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { disconnectInbox, disconnectGmailInbox, syncGmailNow, syncOutlookNow } from "./actions";
import { SyncNowButton } from "@/components/project/sync-now-button";

export default async function InboxSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const membership = user ? await getCurrentMembership(supabase, user.id) : null;
  const canManageGmail = membership !== null && ["owner", "admin"].includes(membership.role);

  const [{ data: connections }, { data: gmailInbox }] = await Promise.all([
    supabase
      .from("connected_inboxes")
      .select("id, user_id, email_address, status, connected_at, last_synced_at")
      .order("connected_at", { ascending: false }),
    supabase
      .from("company_gmail_inbox")
      .select("email_address, status, connected_at, last_synced_at")
      .maybeSingle(),
  ]);

  const myConnection = (connections ?? []).find((c) => c.user_id === user?.id && c.status === "connected");
  const gmailConnected = gmailInbox?.status === "connected";
  const [gmailLocalPart, gmailDomain] = (gmailInbox?.email_address ?? "").split("@");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connected Inboxes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        A shared inbox builds every project&apos;s timeline automatically. You can also connect
        your own Outlook to manually tag individual emails.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Project-timeline inbox</p>
            <p className="text-sm text-muted-foreground">
              {gmailConnected ? gmailInbox!.email_address : "Not connected"}
            </p>
          </div>
          {gmailConnected ? (
            canManageGmail && (
              <div className="flex items-start gap-2">
                <SyncNowButton action={syncGmailNow} />
                <form action={disconnectGmailInbox}>
                  <Button type="submit" variant="outline" size="sm">
                    Disconnect
                  </Button>
                </form>
              </div>
            )
          ) : (
            canManageGmail && (
              <Button asChild size="sm">
                <a href="/api/auth/gmail/start">Connect Gmail</a>
              </Button>
            )
          )}
        </div>

        {gmailConnected ? (
          <p className="mt-4 text-sm text-muted-foreground">
            Forward or CC a project&apos;s address (shown on that project&apos;s page — it looks
            like <span className="font-mono text-foreground">{gmailLocalPart}+CODE@{gmailDomain}</span>)
            to log that email on its timeline automatically. Checked every few minutes.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            {canManageGmail
              ? "One shared inbox for the whole company. Staff forward or CC relevant emails to a project's address to build its timeline automatically — no per-person setup needed."
              : "Ask an owner or admin to connect this."}
          </p>
        )}
      </div>

      <div className="mt-6 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Your personal inbox</p>
            <p className="text-sm text-muted-foreground">
              {myConnection ? myConnection.email_address : "Not connected"}
            </p>
          </div>
          {myConnection ? (
            <div className="flex items-start gap-2">
              <SyncNowButton action={syncOutlookNow} />
              <form action={disconnectInbox}>
                <input type="hidden" name="id" value={myConnection.id} />
                <Button type="submit" variant="outline" size="sm">
                  Disconnect
                </Button>
              </form>
            </div>
          ) : (
            <Button asChild size="sm">
              <a href="/api/auth/microsoft/start">Connect Outlook</a>
            </Button>
          )}
        </div>

        <Alert className="mt-4 border-border bg-muted/40">
          <AlertDescription className="text-muted-foreground">
            Read-only access: we can only view your mail, never send, delete, or edit it. Two ways
            to log an email — tag one manually from your recent messages below, or in Outlook
            apply a project&apos;s category (shown on that project&apos;s page) to any email and
            it&apos;s picked up automatically every few minutes. Either way, only the category we
            were told to look for — or an email you personally tag — is ever read or sent to AI
            for summarizing; everything else in your inbox stays untouched and unread. If a
            colleague is cc&apos;d on the same email, it&apos;s only recorded once. Disconnect at
            any time.
          </AlertDescription>
        </Alert>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Your team
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {(connections ?? [])
            .filter((c) => c.user_id !== user?.id)
            .map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <span className="text-foreground">{c.email_address}</span>
                <Badge variant={c.status === "connected" ? "default" : "outline"}>{c.status}</Badge>
              </li>
            ))}
          {(connections ?? []).filter((c) => c.user_id !== user?.id).length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No other teammates connected yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
