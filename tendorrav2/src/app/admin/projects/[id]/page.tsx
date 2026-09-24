import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { MILESTONE_STYLES, categoryLabel, type MilestoneStatus, type TimelineItem } from "@/lib/timeline";
import { TimelineChart } from "@/components/timeline/timeline-chart";

export const dynamic = "force-dynamic";

/** Read-only view of any tenant's project for support and oversight. */
export default async function AdminProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = createAdminClient();
  const [{ data: project }, { data: items }, { data: emails }] = await Promise.all([
    db.from("projects").select("*, organizations(id, name)").eq("id", id).maybeSingle(),
    db.from("timeline_items").select("id, kind, milestone_status, title, summary, category, occurred_at, ai_generated, email_id").eq("project_id", id).order("occurred_at", { ascending: false }),
    db.from("emails").select("id, subject, from_name, from_address, sent_at, ai_summary, source_format, created_at").eq("project_id", id).order("sent_at", { ascending: false }),
  ]);
  if (!project) notFound();
  const org = project.organizations as unknown as { id: string; name: string };

  return (
    <div className="space-y-6">
      <Link href={`/admin/organizations/${org.id}`} className="text-sm text-slate-500 hover:text-slate-800">← {org.name}</Link>
      <div>
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-sm text-slate-500">
          {org.name} · {project.status} · {formatDate(project.start_date)} → {formatDate(project.target_end_date)}
        </p>
        <p className="mt-1 text-xs text-amber-700">Read-only admin view</p>
      </div>
      <TimelineChart items={(items ?? []) as TimelineItem[]} startDate={project.start_date} targetDate={project.target_end_date} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <h2 className="p-4 font-semibold">Timeline ({items?.length ?? 0})</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {(items ?? []).map((i) => (
              <li key={i.id} className="px-4 py-2.5">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {i.kind === "milestone" && "🏁 "}
                    {i.title}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDate(i.occurred_at)}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {i.kind === "milestone" ? MILESTONE_STYLES[(i.milestone_status ?? "planned") as MilestoneStatus].label : categoryLabel(i.category)}
                  {i.ai_generated && " · AI"}
                </div>
                {i.summary && <p className="mt-1 text-slate-600">{i.summary}</p>}
              </li>
            ))}
          </ul>
        </section>
        <section className="card overflow-hidden">
          <h2 className="p-4 font-semibold">Emails ({emails?.length ?? 0})</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {(emails ?? []).map((e) => (
              <li key={e.id} className="px-4 py-2.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">{e.subject}</span>
                  <span className="shrink-0 text-xs text-slate-500">{formatDateTime(e.sent_at ?? e.created_at)}</span>
                </div>
                <div className="text-xs text-slate-500">{e.from_name ?? e.from_address} · {e.source_format}</div>
                {e.ai_summary && <p className="mt-1 text-slate-600">{e.ai_summary}</p>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
