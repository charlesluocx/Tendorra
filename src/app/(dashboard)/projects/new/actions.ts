"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentCompanyId } from "@/lib/company";

export type CreateProjectState = { error: string | null };

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const postcode = String(formData.get("postcode") ?? "").trim();
  const projectType = String(formData.get("project_type") ?? "").trim();

  if (!name || !address) {
    return { error: "Project name and address are required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };
  const companyId = await getCurrentCompanyId(supabase);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      company_id: companyId,
      name,
      address,
      postcode: postcode || null,
      project_type: projectType || null,
      owner_id: user.id,
    })
    .select("id")
    .single();

  if (error || !project) {
    return { error: error?.message ?? "Could not create the project." };
  }

  redirect(`/projects/${project.id}`);
}
