import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg, requireTool } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { aiEnabled } from "@/lib/ai/extract";
import type { EmailRecord, TimelineItem } from "@/lib/timeline";
import { EmailDropzone } from "@/components/timeline/email-dropzone";
import { ProjectWorkspace } from "@/components/timeline/project-workspace";
import { ProjectSettings } from "./project-settings";

export default async function ProjectPage({ params }: { params: Promise<{ slug: string; projectId: string }> }) {
  const { slug, projectId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(projectId)) notFound();
  const { org, isAdmin } = await requireOrg(slug);
  await requireTool(org.id, "timeline");
  const supabase = await createClient();

  const [{ data: project }, { data: items }, { data: emails }] = await Promise.all([
    supabase.from("projects").select("*").eq("id", projectId).eq("org_id", org.id).maybeSingle(),
    supabase
      .from("timeline_items")
      .select("id, kind, milestone_status, title, summary, category, occurred_at, ai_generated, email_id")
      .eq("project_id", projectId)
      .order("occurred_at"),
    supabase
      .from("emails")
      .select("id, subject, from_name, from_address, to_addresses, sent_at, ai_summary, body_text, file_name, source_format, attachments, storage_path, created_at")
      .eq("project_id", projectId)
      .order("sent_at", { ascending: false, nullsFirst: false }),
  ]);
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/o/${slug}/timeline`} className="text-sm text-slate-500 hover:text-slate-800">← All projects</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>
            <p className="text-sm text-slate-500">
              {[project.code, project.address].filter(Boolean).join(" · ")}
              {project.start_date || project.target_end_date
                ? ` · ${formatDate(project.start_date)} → ${formatDate(project.target_end_date)}`
                : ""}
            </p>
            {project.description && <p className="mt-2 max-w-3xl text-sm text-slate-600">{project.description}</p>}
          </div>
          <ProjectSettings slug={slug} project={project} canDelete={isAdmin} />
        </div>
      </div>

      {!aiEnabled() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          Claude isn&apos;t connected yet (no <code>ANTHROPIC_API_KEY</code>), so each email becomes one basic entry. Add the key to
          get automatic event and milestone extraction.
        </div>
      )}

      <EmailDropzone orgId={org.id} projectId={project.id} />

      <ProjectWorkspace
        slug={slug}
        projectId={project.id}
        items={(items ?? []) as TimelineItem[]}
        emails={(emails ?? []) as EmailRecord[]}
        startDate={project.start_date}
        targetDate={project.target_end_date}
      />
    </div>
  );
}
