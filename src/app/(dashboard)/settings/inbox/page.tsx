import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { disconnectInbox } from "./actions";

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

  const { data: connections } = await supabase
    .from("connected_inboxes")
    .select("id, user_id, email_address, status, connected_at, last_synced_at")
    .order("connected_at", { ascending: false });

  const myConnection = (connections ?? []).find((c) => c.user_id === user?.id && c.status === "connected");

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connected Inboxes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect your Outlook inbox so you can tag project emails straight into the activity feed.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-6 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Your inbox</p>
            <p className="text-sm text-muted-foreground">
              {myConnection ? myConnection.email_address : "Not connected"}
            </p>
          </div>
          {myConnection ? (
            <form action={disconnectInbox}>
              <input type="hidden" name="id" value={myConnection.id} />
              <Button type="submit" variant="outline" size="sm">
                Disconnect
              </Button>
            </form>
          ) : (
            <Button asChild size="sm">
              <a href="/api/auth/microsoft/start">Connect Outlook</a>
            </Button>
          )}
        </div>

        <Alert className="mt-4 border-border bg-muted/40">
          <AlertDescription className="text-muted-foreground">
            Read-only access: we can only view your mail, never send, delete, or edit it. You
            browse your own recent messages to pick one, and only the emails <em>you</em> choose
            to tag to a project are stored or sent to AI for summarizing — everything else stays
            in your inbox, untouched. Disconnect at any time.
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
