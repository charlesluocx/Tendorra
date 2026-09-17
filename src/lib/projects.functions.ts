import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ProjectSummary = {
  id: string;
  name: string;
  address: string;
  postcode: string | null;
  current_phase: string | null;
  confirmedCategories: number;
  receivedQuotes: number;
};

export const getMyProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProjectSummary[]> => {
    const { supabase, userId } = context;

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, address, postcode, current_phase, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });

    if (projectsError || !projects) {
      throw new Error(projectsError?.message ?? "Could not load projects");
    }

    const projectIds = projects.map((p) => p.id);
    if (projectIds.length === 0) return [];

    const [{ data: categoryRows }, { data: quoteRows }] = await Promise.all([
      supabase
        .from("project_categories")
        .select("project_id")
        .eq("status", "confirmed")
        .in("project_id", projectIds),
      supabase
        .from("quotes")
        .select("project_id")
        .eq("status", "submitted")
        .in("project_id", projectIds),
    ]);

    const categoryCounts = new Map<string, number>();
    for (const row of categoryRows ?? []) {
      categoryCounts.set(row.project_id, (categoryCounts.get(row.project_id) ?? 0) + 1);
    }

    const quoteCounts = new Map<string, number>();
    for (const row of quoteRows ?? []) {
      quoteCounts.set(row.project_id, (quoteCounts.get(row.project_id) ?? 0) + 1);
    }

    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      address: p.address,
      postcode: p.postcode,
      current_phase: p.current_phase,
      confirmedCategories: categoryCounts.get(p.id) ?? 0,
      receivedQuotes: quoteCounts.get(p.id) ?? 0,
    }));
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => ({
    projectId: String(input.projectId),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("id", data.projectId)
      .eq("owner_id", userId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");

    const { data: docs } = await supabase
      .from("project_documents")
      .select("file_path")
      .eq("project_id", data.projectId);

    const paths = (docs ?? []).map((d) => d.file_path).filter(Boolean);
    if (paths.length > 0) {
      await supabase.storage.from("project-documents").remove(paths);
    }

    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", data.projectId)
      .eq("owner_id", userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

export const removeConsultantInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; quoteId: string }) => ({
    projectId: String(input.projectId),
    quoteId: String(input.quoteId),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { error } = await context.supabase
      .from("quotes")
      .delete()
      .eq("id", data.quoteId)
      .eq("project_id", data.projectId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
