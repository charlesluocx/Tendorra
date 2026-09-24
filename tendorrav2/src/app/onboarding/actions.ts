"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/components/form-message";

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function createOrganization(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Company name must be at least 2 characters." };

  const base = slugify(String(formData.get("slug") ?? "") || name) || "company";
  const supabase = await createClient();

  // Retry with a numeric suffix if the slug is taken.
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? base : `${base}-${Math.floor(Math.random() * 9000 + 1000)}`;
    const { data, error } = await supabase.rpc("create_organization", { p_name: name, p_slug: slug });
    if (!error && data) redirect(`/o/${(data as { slug: string }).slug}`);
    if (error && !error.message.includes("duplicate key")) return { error: error.message };
  }
  return { error: "Could not find a free workspace URL — try a different one." };
}
