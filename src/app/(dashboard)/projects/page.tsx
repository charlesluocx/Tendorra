import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";

export default async function ProjectsPage() {
  const supabase = await createClient();

  const [{ data: projects }, { data: statuses }, { data: openItems }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, address, postcode, current_phase, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("project_activity_status").select("project_id, last_activity_at, is_stale"),
    supabase.from("action_items").select("project_id").neq("status", "done"),
  ]);

  const statusByProject = new Map((statuses ?? []).map((s) => [s.project_id, s]));
  const openCountByProject = new Map<string, number>();
  for (const item of openItems ?? []) {
    openCountByProject.set(item.project_id, (openCountByProject.get(item.project_id) ?? 0) + 1);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live activity across every project your team is running.
          </p>
        </div>
        <Button asChild>
          <Link href="/projects/new">New Project</Link>
        </Button>
      </div>

      {(!projects || projects.length === 0) && (
        <div className="mt-16 flex flex-col items-center justify-center text-center">
          <p className="text-sm text-muted-foreground">No projects yet</p>
          <Button asChild className="mt-4">
            <Link href="/projects/new">Create your first project</Link>
          </Button>
        </div>
      )}

      {projects && projects.length > 0 && (
        <ul className="mt-8 space-y-3">
          {projects.map((project) => {
            const status = statusByProject.get(project.id);
            const openCount = openCountByProject.get(project.id) ?? 0;
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-5 transition-colors hover:border-ring/60 hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-card-foreground">
                        {project.name}
                      </h2>
                      {status?.is_stale && (
                        <Badge variant="destructive" className="shrink-0">
                          Gone quiet
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {project.address}
                      {project.postcode ? ` · ${project.postcode}` : ""}
                    </p>
                    {project.current_phase && (
                      <span className="mt-3 inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {project.current_phase}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-sm text-muted-foreground">
                    <span className="block">
                      {status?.last_activity_at
                        ? `Active ${formatDistanceToNow(new Date(status.last_activity_at), { addSuffix: true })}`
                        : "No activity yet"}
                    </span>
                    {openCount > 0 && (
                      <span className="block">
                        {openCount} open {openCount === 1 ? "action" : "actions"}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
