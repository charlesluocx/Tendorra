import { NextResponse } from "next/server";
import { runGmailSync } from "@/lib/sync/gmail-sync";

// Triggered on a schedule by .github/workflows/sync-gmail.yml, same pattern
// as /api/cron/stale-reminders. Protected by CRON_SECRET since it acts
// across every company's shared Gmail inbox with the service-role client.
// The "Sync now" button in settings/inbox calls runGmailSync directly
// (scoped to just that company) instead of hitting this route, since it
// already runs as a signed-in, permission-checked server action.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runGmailSync();
  return NextResponse.json(result);
}
