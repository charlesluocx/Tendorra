import { NextResponse } from "next/server";
import { runOutlookCategorySync } from "@/lib/sync/outlook-category-sync";

// Triggered on a schedule by .github/workflows/sync-outlook-categories.yml.
// The "Sync now" button in settings/inbox calls runOutlookCategorySync
// directly (scoped to just that person's own connection) instead of hitting
// this route, since it already runs as a signed-in server action.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runOutlookCategorySync();
  return NextResponse.json(result);
}
