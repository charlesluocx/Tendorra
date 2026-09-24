import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

export default async function UsageSettingsPage() {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("ai_usage_log")
    .select("id, feature, model, input_tokens, output_tokens, total_tokens, created_at, projects(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const entries = rows ?? [];
  const monthStart = startOfMonthIso();
  const thisMonth = entries.filter((e) => e.created_at >= monthStart);

  const sumTokens = (list: typeof entries) => list.reduce((sum, e) => sum + (e.total_tokens ?? 0), 0);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">AI usage</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Token usage from AI features (currently just parsing tagged emails), for cost visibility.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-md border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">This month</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{sumTokens(thisMonth).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">tokens · {thisMonth.length} calls</p>
        </div>
        <div className="rounded-md border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Last 100 calls</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">{sumTokens(entries).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">tokens · {entries.length} calls</p>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent activity</h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {entries.map((entry) => {
            const project = entry.projects as unknown as { name: string } | null;
            return (
              <li key={entry.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{project?.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(entry.created_at).toLocaleString()} · {entry.model}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {entry.total_tokens?.toLocaleString() ?? 0} tokens
                </Badge>
              </li>
            );
          })}
          {entries.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No AI usage yet.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
