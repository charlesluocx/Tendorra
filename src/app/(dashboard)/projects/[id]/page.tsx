import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow, format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { CallNoteForm } from "@/components/project/call-note-form";
import { ManualUpdateForm } from "@/components/project/manual-update-form";
import { ActionItemForm } from "@/components/project/action-item-form";
import { StatusSelect } from "@/components/project/status-select";
import { ProjectTimeline, type TimelineEvent } from "@/components/project/timeline";
import { CopyEmailButton } from "@/components/project/copy-email-button";
import { SyncNowButton } from "@/components/project/sync-now-button";
import { setActionItemStatus, setChecklistItemStatus, syncProjectEmailsNow } from "./actions";

const SOURCE_LABEL: Record<string, string> = {
  email: "Email",
  call_note: "Call",
  manual: "Update",
};

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: project }, { data: activity }, { data: actionItems }, { data: checklist }, { data: profiles }] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, company_id, name, address, postcode, current_phase, email_code")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("activity_log")
        .select("id, source_type, summary, commitments, key_dates, occurred_at, created_by")
        .eq("project_id", id)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("action_items")
        .select("id, title, status, due_date, assigned_to")
        .eq("project_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("project_checklist_items")
        .select(
          "id, title, status, expected_at, completed_at, position, phase_id, lifecycle_phases(name, position)",
        )
        .eq("project_id", id)
        .order("position", { ascending: true }),
      supabase.from("profiles").select("id, email, full_name"),
    ]);

  if (!project) notFound();

  const { data: gmailInbox } = await supabase
    .from("company_gmail_inbox")
    .select("email_address, status")
    .eq("company_id", project.company_id)
    .maybeSingle();

  const projectEmailAddress =
    gmailInbox?.status === "connected"
      ? gmailInbox.email_address.replace("@", `+${project.email_code}@`)
      : null;

  const timelineEvents: TimelineEvent[] = [
    ...(activity ?? []).map((entry) => ({
      id: entry.id,
      date: entry.occurred_at,
      kind: entry.source_type as TimelineEvent["kind"],
      title: entry.summary,
    })),
    ...(checklist ?? [])
      .filter((item) => item.completed_at)
      .map((item) => {
        const phase = item.lifecycle_phases as unknown as { name: string } | null;
        return {
          id: `${item.id}-done`,
          date: item.completed_at!,
          kind: "milestone_done" as const,
          title: item.title,
          subtitle: phase?.name,
        };
      }),
    ...(checklist ?? [])
      .filter((item) => item.expected_at && item.status !== "done")
      .map((item) => {
        const phase = item.lifecycle_phases as unknown as { name: string } | null;
        return {
          id: `${item.id}-expected`,
          date: item.expected_at!,
          kind: "milestone_upcoming" as const,
          title: item.title,
          subtitle: phase?.name,
        };
      }),
  ];

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id, p.full_name || p.email || "Someone"]),
  );

  const phaseGroups = new Map<string, { name: string; items: typeof checklist }>();
  for (const item of checklist ?? []) {
    const phase = item.lifecycle_phases as unknown as { name: string; position: number } | null;
    const key = phase?.name ?? "Other";
    if (!phaseGroups.has(key)) phaseGroups.set(key, { name: key, items: [] as typeof checklist });
    phaseGroups.get(key)!.items!.push(item);
  }

  return (
    <div>
      <Link href="/projects" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to projects
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{project.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {project.address}
          {project.postcode ? ` · ${project.postcode}` : ""}
        </p>
      </div>

      <div className="mt-4 space-y-2">
        {projectEmailAddress ? (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
            <span className="text-xs text-muted-foreground">Forward emails here to log them on this timeline:</span>
            <code className="text-xs font-medium text-foreground">{projectEmailAddress}</code>
            <CopyEmailButton value={projectEmailAddress} />
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            <Link href="/settings/inbox" className="underline underline-offset-4 hover:text-foreground">
              Connect a project-timeline inbox
            </Link>{" "}
            to get an email address for this project.
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Or, in your own Outlook, tag emails with this category to log them here automatically:
          </span>
          <code className="text-xs font-medium text-foreground">{project.email_code}</code>
          <CopyEmailButton value={project.email_code} />
        </div>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Timeline</h2>
            <div className="mt-3 rounded-md border border-border p-4">
              <ProjectTimeline events={timelineEvents} />
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Activity Feed
              </h2>
              <div className="flex items-center gap-3">
                <SyncNowButton action={syncProjectEmailsNow} hiddenFields={{ project_id: id }} />
                <Link
                  href={`/projects/${id}/inbox`}
                  className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Tag an email →
                </Link>
              </div>
            </div>
            <div className="mt-3 space-y-3">
              <ManualUpdateForm projectId={id} />
              <CallNoteForm projectId={id} />
            </div>

            <ol className="mt-6 space-y-4">
              {(activity ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No activity logged yet.</p>
              )}
              {(activity ?? []).map((entry) => (
                <li key={entry.id} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{SOURCE_LABEL[entry.source_type] ?? entry.source_type}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.occurred_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.summary}</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {entry.created_by ? nameById.get(entry.created_by) ?? "Someone" : "System"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Checklist
            </h2>
            <div className="mt-3 space-y-4">
              {Array.from(phaseGroups.values()).map((group) => (
                <div key={group.name}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.name}
                  </h3>
                  <ul className="mt-2 space-y-1.5">
                    {(group.items ?? []).map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span
                          className={item.status === "done" ? "text-muted-foreground line-through" : "text-foreground"}
                        >
                          {item.title}
                        </span>
                        <StatusSelect
                          id={item.id}
                          projectId={id}
                          status={item.status}
                          action={setChecklistItemStatus}
                          options={[
                            { value: "pending", label: "Pending" },
                            { value: "in_progress", label: "In progress" },
                            { value: "done", label: "Done" },
                            { value: "skipped", label: "Skipped" },
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Action Items
            </h2>
            <div className="mt-3">
              <ActionItemForm projectId={id} />
            </div>
            <ul className="mt-4 space-y-2">
              {(actionItems ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No open action items.</p>
              )}
              {(actionItems ?? []).map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p
                      className={
                        item.status === "done"
                          ? "truncate text-muted-foreground line-through"
                          : "truncate text-foreground"
                      }
                    >
                      {item.title}
                    </p>
                    {item.due_date && (
                      <p className="text-xs text-muted-foreground">
                        Due {format(new Date(item.due_date), "d MMM yyyy")}
                      </p>
                    )}
                  </div>
                  <StatusSelect
                    id={item.id}
                    projectId={id}
                    status={item.status}
                    action={setActionItemStatus}
                    options={[
                      { value: "open", label: "Open" },
                      { value: "in_progress", label: "In progress" },
                      { value: "done", label: "Done" },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
