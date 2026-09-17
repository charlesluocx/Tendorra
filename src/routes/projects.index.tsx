import { useEffect, useState } from "react";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getMyProjects, type ProjectSummary } from "@/lib/projects.functions";

export const Route = createFileRoute("/projects/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "My Projects — TenderX" },
      {
        name: "description",
        content:
          "View and manage your property development projects on TenderX.",
      },
      { property: "og:title", content: "My Projects — TenderX" },
      {
        property: "og:description",
        content: "View and manage your property development projects on TenderX.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const navigate = useNavigate();
  const fetchProjects = useServerFn(getMyProjects);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await fetchProjects({ data: undefined });
        if (!cancelled) setProjects(rows);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load projects");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchProjects]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-foreground">
            TenderX
          </Link>
          <Link
            to="/projects/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            New Project
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:py-16">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            My Projects
          </h1>
          <Link
            to="/projects/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            New Project
          </Link>
        </div>

        {error && (
          <p className="mt-8 text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        {!error && projects === null && (
          <p className="mt-8 text-sm text-muted-foreground">Loading…</p>
        )}

        {!error && projects !== null && projects.length === 0 && (
          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">No projects yet</p>
            <Link
              to="/projects/new"
              className="mt-4 inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Create your first project
            </Link>
          </div>
        )}

        {!error && projects !== null && projects.length > 0 && (
          <ul className="mt-8 space-y-3">
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  onClick={() => navigate({ href: `/projects/${project.id}` })}
                  className="group flex w-full items-center justify-between rounded-lg border border-border bg-card p-5 text-left transition-colors hover:border-ring/60 hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-card-foreground">
                      {project.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {project.address}
                      {project.postcode ? ` · ${project.postcode}` : ""}
                    </p>
                    {project.current_phase && (
                      <span className="mt-3 inline-flex rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {project.current_phase}
                      </span>
                    )}
                  </div>
                  <div className="shrink-0 pl-4 text-right text-sm text-muted-foreground">
                    <span className="block">
                      {project.confirmedCategories}{" "}
                      {project.confirmedCategories === 1 ? "category" : "categories"}
                    </span>
                    <span className="block">
                      {project.receivedQuotes}{" "}
                      {project.receivedQuotes === 1 ? "quote received" : "quotes received"}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
