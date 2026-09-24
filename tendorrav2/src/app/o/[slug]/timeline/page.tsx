import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requireTool } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createProject } from "./actions";
import { ProjectForm } from "./project-form";

export const metadata = { title: "Project Timeline" };

const STATUS_BADGE: Record<string, string> = {
  planning: "bg-violet-50 text-violet-700",
  active: "bg-emerald-50 text-emerald-700",
  on_hold: "bg-amber-50 text-amber-700",
  completed: "bg-slate-100 text-slate-600",
  archived: "bg-slate-100 text-slate-400",
};

export default async function TimelineProjects({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string; archived?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const { org } = await requireOrg(slug);
  await requireTool(org.id, "timeline");
  const supabase = await createClient();

  let query = supabase
    .from("projects")
    .select("id, name, code, address, status, start_date, target_end_date, updated_at, timeline_items(kind, milestone_status, occurred_at), emails(count)")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false });
  if (!sp.archived) query = query.neq("status", "archived");
  const { data: projects } = await query;

  const showForm = sp.new === "1" || (projects ?? []).length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Project Timeline</h1>
          <p className="text-slate-500">Pick a project, then drag emails onto it to build its history.</p>
        </div>
        <div className="flex gap-2">
          <Link href={sp.archived ? `?` : `?archived=1`} className="btn-ghost">
            {sp.archived ? "Hide archived" : "Show archived"}
          </Link>
          {!showForm && <Link href="?new=1" className="btn-primary">+ New project</Link>}
        </div>
      </div>

      {showForm && (
        <div className="card p-6">
          <h2 className="mb-4 font-semibold">New project</h2>
          <ProjectForm action={createProject.bind(null, slug)} submitLabel="Create project" />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(projects ?? []).map((p) => {
          const items = (p.timeline_items ?? []) as { kind: string; milestone_status: string | null; occurred_at: string }[];
          const milestones = items.filter((i) => i.kind === "milestone");
          const achieved = milestones.filter((m) => m.milestone_status === "achieved").length;
          const emailCount = (p.emails as unknown as { count: number }[])?.[0]?.count ?? 0;
          const last = items.reduce<string | null>((acc, i) => (!acc || i.occurred_at > acc ? i.occurred_at : acc), null);
          const pct = milestones.length ? Math.round((achieved / milestones.length) * 100) : 0;
          return (
            <Link key={p.id} href={`/o/${slug}/timeline/${p.id}`} className="card flex flex-col p-5 transition hover:border-brand-500 hover:shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold">{p.name}</h3>
                  <p className="truncate text-xs text-slate-500">{[p.code, p.address].filter(Boolean).join(" · ") || "—"}</p>
                </div>
                <span className={`badge shrink-0 capitalize ${STATUS_BADGE[p.status] ?? ""}`}>{p.status.replace("_", " ")}</span>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div><div className="text-lg font-semibold">{items.length - milestones.length}</div><div className="text-xs text-slate-500">Events</div></div>
                <div><div className="text-lg font-semibold">{achieved}/{milestones.length}</div><div className="text-xs text-slate-500">Milestones</div></div>
                <div><div className="text-lg font-semibold">{emailCount}</div><div className="text-xs text-slate-500">Emails</div></div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-3 text-xs text-slate-500">
                {last ? `Last activity ${formatDate(last)}` : "No activity yet — drop in an email"}
                {p.target_end_date ? ` · Target ${formatDate(p.target_end_date)}` : ""}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
