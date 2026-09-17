import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Suggestion = { category: string; reason: string };
export type SuggestedCategory = { categoryId: string; name: string; reason: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string" },
          reason: { type: "string" },
        },
        required: ["category", "reason"],
      },
    },
  },
  required: ["suggestions"],
} as const;

export async function readStreamedText(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  let completed = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload);
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
          text += event.delta;
        } else if (event.type === "response.completed") {
          const out = event.response?.output_text;
          if (typeof out === "string") completed = out;
          else if (Array.isArray(out)) completed = out.join("");
        }
      } catch {
        // ignore keep-alive / partial frames
      }
    }
  }
  return text || completed;
}

export const suggestCategories = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, address, project_type, current_phase")
      .eq("id", data.projectId)
      .single();

    if (projectError || !project) {
      return { suggestions: [] as SuggestedCategory[], failed: true };
    }

    const { data: documents } = await supabase
      .from("project_documents")
      .select("file_name")
      .eq("project_id", data.projectId);

    const { data: categories } = await supabase
      .from("consultant_categories")
      .select("id, name, is_continuing")
      .eq("is_predefined", true)
      .eq("status", "active");

    // Continuing roles (Architect, Town Planner, Project Manager) live in the
    // persistent Project Team section: never suggest one that is already confirmed.
    const { data: confirmed } = await supabase
      .from("project_categories")
      .select("category_id")
      .eq("project_id", data.projectId)
      .eq("status", "confirmed");
    const confirmedIds = new Set((confirmed ?? []).map((r) => r.category_id));

    const categoryList = (categories ?? []).filter(
      (c) => !(c.is_continuing && confirmedIds.has(c.id)),
    );
    if (categoryList.length === 0) {
      return { suggestions: [] as SuggestedCategory[], failed: true };
    }

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { suggestions: [] as SuggestedCategory[], failed: true };

    const phaseGuidance: Record<string, string> = {
      "Feasibility & Concept":
        "This project is in the Feasibility & Concept phase, so prioritise categories typically needed now, such as Architect, Town Planner, Land Surveyor, and Arborist.",
      "Planning & Approval":
        "This project is in the Planning & Approval phase, so prioritise categories typically needed now, such as Traffic Engineer, Acoustic Consultant, Heritage Consultant, ESD/Sustainability Consultant, Access Consultant, and other specialist report consultants.",
      "Engineering & Delivery":
        "This project is in the Engineering & Delivery phase, so prioritise categories typically needed now, such as Structural Engineer, Civil Engineer, Geotechnical Engineer, MEP Engineer, Building Surveyor, and Project Manager.",
      "Marketing & Design":
        "This project is in the Marketing & Design phase, so prioritise categories typically needed now, above all Marketing/Design Agency and 3D Artist/Visualiser, and secondarily Sales/Project Marketing Agent, Architect, and Landscape Architect.",
      "Sales/Legal & Ownership":
        "This project is in the Sales/Legal & Ownership phase, so prioritise categories typically needed now, such as Sales/Project Marketing Agent, Conveyancer/Property Lawyer, and Owners Corporation Manager.",
    };
    const phaseNote = project.current_phase ? phaseGuidance[project.current_phase] : undefined;

    const prompt = [
      "You advise Australian property developers on which professional consultants a development project needs.",
      "",
      `Project name: ${project.name}`,
      `Site address: ${project.address}`,
      project.project_type ? `Project type: ${project.project_type}` : "",
      project.current_phase ? `Current phase: ${project.current_phase}` : "",
      documents && documents.length > 0
        ? `Uploaded planning documents: ${documents.map((d) => d.file_name).join(", ")}`
        : "No planning documents uploaded.",
      "",
      phaseNote,
      phaseNote
        ? "Use the phase as a weighting signal only: if the project details or uploaded documents clearly indicate a category from another phase is needed, include it anyway. Never exclude a clearly relevant category just because of the phase."
        : "",
      "Choose the consultant categories from this list that are likely relevant to this project.",
      "Only use category names exactly as written here:",
      categoryList.map((c) => `- ${c.name}`).join("\n"),
      "",
      "Return between 4 and 12 categories, each with one short sentence explaining why it is needed for this specific project.",
    ]
      .filter(Boolean)
      .join("\n");

    let parsed: { suggestions?: Suggestion[] } | null = null;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          input: prompt,
          stream: true,
          reasoning: { effort: "low" },
          text: {
            format: {
              type: "json_schema",
              name: "consultant_suggestions",
              strict: true,
              schema: SCHEMA,
            },
          },
        }),
      });

      if (!res.ok) {
        console.error("AI gateway error", res.status, await res.text());
        return { suggestions: [] as SuggestedCategory[], failed: true };
      }

      const text = await readStreamedText(res);
      parsed = text ? JSON.parse(text) : null;
    } catch (error) {
      console.error("suggestCategories failed", error);
      return { suggestions: [] as SuggestedCategory[], failed: true };
    }

    const byName = new Map(categoryList.map((c) => [c.name.toLowerCase(), c]));
    const rows: { category_id: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const suggestion of parsed?.suggestions ?? []) {
      const match = byName.get(String(suggestion.category ?? "").trim().toLowerCase());
      if (!match || seen.has(match.id)) continue;
      seen.add(match.id);
      rows.push({ category_id: match.id, reason: String(suggestion.reason ?? "").trim() });
    }

    if (rows.length === 0) return { suggestions: [] as SuggestedCategory[], failed: true };

    await supabase.from("project_categories").upsert(
      rows.map((r) => ({
        project_id: data.projectId,
        category_id: r.category_id,
        reason: r.reason,
        source: "ai_suggested",
        status: "suggested",
      })),
      { onConflict: "project_id,category_id" },
    );

    return {
      failed: false,
      suggestions: rows.map((r) => ({
        categoryId: r.category_id,
        name: categoryList.find((c) => c.id === r.category_id)!.name,
        reason: r.reason,
      })),
    };
  });
