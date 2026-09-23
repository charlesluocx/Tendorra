import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listRecentMessages, getValidAccessToken } from "@/lib/microsoft-graph";
import { TagEmailButton } from "@/components/project/tag-email-button";

export default async function ProjectInboxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: statusRow } = await supabase
    .from("connected_inboxes")
    .select("id, status")
    .eq("user_id", user?.id ?? "")
    .eq("status", "connected")
    .maybeSingle();

  if (!statusRow) {
    return (
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm text-muted-foreground">
          Connect your Outlook inbox to tag emails into this project&apos;s activity feed.
        </p>
        <Link href="/settings/inbox" className="mt-3 inline-block text-sm text-foreground underline underline-offset-4">
          Go to inbox settings
        </Link>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: connection } = await admin
    .from("connected_inboxes")
    .select("id, access_token, refresh_token, token_expires_at")
    .eq("id", statusRow.id)
    .single();

  let messages: Awaited<ReturnType<typeof listRecentMessages>> = [];
  let loadError: string | null = null;
  try {
    if (connection) {
      const accessToken = await getValidAccessToken(connection);
      messages = await listRecentMessages(accessToken, 25);
    }
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load your inbox.";
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link href={`/projects/${id}`} className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to project
      </Link>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Tag an Email</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Pick a recent email to add to this project&apos;s activity feed. Tagging kicks off AI parsing right away.
      </p>

      {loadError && (
        <p className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {loadError}
        </p>
      )}

      <ul className="mt-6 divide-y divide-border rounded-md border border-border">
        {messages.map((message) => (
          <li key={message.id} className="flex items-start justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{message.subject || "(no subject)"}</p>
              <p className="truncate text-xs text-muted-foreground">
                {message.from?.emailAddress?.address ?? "Unknown sender"} ·{" "}
                {format(new Date(message.receivedDateTime), "d MMM yyyy, HH:mm")}
              </p>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{message.bodyPreview}</p>
            </div>
            <TagEmailButton
              projectId={id}
              connectionId={statusRow.id}
              messageId={message.id}
              internetMessageId={message.internetMessageId}
              subject={message.subject ?? ""}
              fromAddress={message.from?.emailAddress?.address ?? ""}
              receivedAt={message.receivedDateTime}
              bodyPreview={message.bodyPreview}
            />
          </li>
        ))}
        {messages.length === 0 && !loadError && (
          <li className="p-4 text-sm text-muted-foreground">No recent messages found.</li>
        )}
      </ul>
    </div>
  );
}
