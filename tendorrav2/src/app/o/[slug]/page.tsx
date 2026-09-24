import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth";
import { TOOLS } from "@/lib/tools/registry";
import { formatDate } from "@/lib/format";

export default async function OrgHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, profile, isAdmin } = await requireOrg(slug);
  const supabase = await createClient();

  const [{ data: enabled }, { count: projectCount }, { data: recentMilestones }] = await Promise.all([
    supabase.from("org_tools").select("tool_key").eq("org_id", org.id).eq("enabled", true),
    supabase.from("projects").select("id", { count: "exact", head: true }).eq("org_id", org.id).neq("status", "archived"),
    supabase
      .from("timeline_items")
      .select("id, title, occurred_at, milestone_status, project_id, projects(name)")
      .eq("org_id", org.id)
      .eq("kind", "milestone")
      .order("occurred_at", { ascending: false })
      .limit(6),
  ]);
  const enabledKeys = new Set((enabled ?? []).map((t) => t.tool_key));
  const firstName = (profile.full_name ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{firstName ? `Hi ${firstName}` : "Welcome"} 👋</h1>
        <p className="text-slate-500">{org.name} · {projectCount ?? 0} active projects</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Tools</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((tool) => {
            const on = tool.status === "live" && enabledKeys.has(tool.key);
            const inner = (
              <>
                <div className="flex items-start justify-between">
                  <span className="text-2xl">{tool.icon}</span>
                  {tool.status === "coming_soon" ? (
                    <span className="badge bg-slate-100 text-slate-500">Coming soon</span>
                  ) : !on ? (
                    <span className="badge bg-amber-50 text-amber-700">Off</span>
                  ) : null}
                </div>
                <h3 className="mt-3 font-semibold">{tool.name}</h3>
                <p className="mt-1 text-sm text-slate-500">{tool.tagline}</p>
              </>
            );
            return on ? (
              <Link key={tool.key} href={`/o/${org.slug}/${tool.key}`} className="card p-5 transition hover:border-brand-500 hover:shadow-md">
                {inner}
              </Link>
            ) : (
              <div key={tool.key} className="card p-5 opacity-70">{inner}</div>
            );
          })}
        </div>
        {isAdmin && (
          <p className="mt-3 text-xs text-slate-500">
            Turn tools on or off for your company in <Link className="text-brand-600" href={`/o/${org.slug}/settings`}>Settings</Link>.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-500 uppercase">Latest milestones</h2>
        <div className="card divide-y divide-slate-100">
          {(recentMilestones ?? []).length === 0 && (
            <p className="p-5 text-sm text-slate-500">
              No milestones yet. Open <Link className="text-brand-600" href={`/o/${org.slug}/timeline`}>Project Timeline</Link> and drop in some emails.
            </p>
          )}
          {(recentMilestones ?? []).map((m) => (
            <Link key={m.id} href={`/o/${org.slug}/timeline/${m.project_id}`} className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.title}</div>
                <div className="text-xs text-slate-500">{(m.projects as unknown as { name: string } | null)?.name}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <div>{formatDate(m.occurred_at)}</div>
                <div className="capitalize">{m.milestone_status}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
