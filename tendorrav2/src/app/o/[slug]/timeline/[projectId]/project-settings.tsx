"use client";

import { useState, useTransition } from "react";
import { ProjectForm, type ProjectValues } from "../project-form";
import { deleteProject, updateProject } from "../actions";

export function ProjectSettings({
  slug,
  project,
  canDelete,
}: {
  slug: string;
  project: ProjectValues & { id: string };
  canDelete: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <button className="btn-secondary" onClick={() => setOpen(true)}>Edit project</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16" onClick={() => setOpen(false)}>
          <div className="card w-full max-w-2xl p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit project</h2>
              <button className="btn-ghost" onClick={() => setOpen(false)}>✕</button>
            </div>
            <ProjectForm action={updateProject.bind(null, slug, project.id)} initial={project} submitLabel="Save project" />
            {canDelete && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <button
                  className="btn-danger"
                  disabled={pending}
                  onClick={() => {
                    if (confirm("Delete this project, its timeline and all its emails? This cannot be undone.")) {
                      startTransition(() => deleteProject(slug, project.id));
                    }
                  }}
                >
                  Delete project
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
