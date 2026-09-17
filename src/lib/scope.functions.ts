import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readStreamedText } from "@/lib/suggest-categories.functions";

const SCOPE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: { type: "array", items: { type: "string" } },
  },
  required: ["items"],
} as const;

export type ScopeResult =
  | { status: "not_configured" }
  | { status: "failed"; message: string }
  | { status: "ok"; items: string[] };

const ARCHITECT_REFERENCE = `Reference structure drawn from real Australian architectural fee proposals. A professional architectural scope is staged, and each stage lists concrete deliverables and coordination duties:
- Feasibility / Concept: explore development options for the site, test yield and built form, prepare concept plans, liaise with the town planner on relevant policy and overlays.
- Schematic Design: developed floor plans, sections and elevations, a 3D massing model, pre-application liaison with Council, coordination with traffic, landscape, waste and ESD consultants.
- Town Planning: prepare the planning submission drawing set (site analysis and design response, floor plans, elevations, shadow diagrams, 3D renders), liaise with the town planner through lodgement.
- Post-lodgement: respond to Council requests for further information and objections, prepare amended drawings, provide VCAT support if required.
- Design Development: coordinate with the building surveyor and services consultants, resolve and finalise layouts.
- Marketing Assistance: marketing drawings and finishes schedules, coordination with the 3D renderer and perspective artists.
- Contract Documentation: construction drawings and specifications, coordinate the building permit documentation.
- Construction Stage (only if included): site inspections, responding to RFIs, shop drawing review.`;

const PLANNER_REFERENCE = `Reference structure for a town planner's scope: site and policy assessment against the planning scheme, zones and overlays; pre-application meeting and advice; preparation of the planning permit application including the written planning report and supporting documentation; lodgement and management of the application with Council; responding to requests for further information; liaison with Council officers and objectors, including mediation; and VCAT representation or support if the application is refused or appealed.`;

// Depth guidance per project phase. The scope must match how early-stage the
// project actually is — early phases get short, advisory scopes, never
// submission-ready or downstream content.
const PHASE_DEPTH: Record<string, string> = {
  Schematic: `DEPTH GUIDANCE (Schematic — earliest stage, keep the scope minimal):
- Cover ONLY: reviewing the site address and basic project details provided; assessing high-level development potential (zoning fit, indicative yield/massing at a glance); producing a simple initial concept read.
- For a Town Planner specifically: a brief initial view on zoning/overlay implications and the likely permit pathway only.
- Explicitly EXCLUDE: submission-ready drawings, detailed design documentation, marketing content, construction-stage content.
- Keep the scope short (toward the 6-item end of the allowed range).`,
  "Feasibility & Concept": `DEPTH GUIDANCE (Feasibility & Concept):
- Explore development options in more depth than Schematic; concept plans sufficient for a feasibility decision.
- Include land survey / arborist input and preliminary town planner liaison on policy fit where relevant to the category.
- Still pre-permit: NO submission drawings yet.`,
  "Planning & Approval": `DEPTH GUIDANCE (Planning & Approval):
- This is the actual submission scope: site analysis, design response, floor plans, elevations, shadow diagrams, lodgement.
- Include responding to Council requests for further information and objectors, and VCAT support if required.`,
  "Engineering & Delivery": `DEPTH GUIDANCE (Engineering & Delivery):
- Scope appropriate to the category (structural/civil/geotechnical engineer, building surveyor, project manager): working drawings, building permit documentation, construction-readiness coordination.`,
  "Sales/Legal & Ownership": `DEPTH GUIDANCE (Sales/Legal & Ownership):
- Scope appropriate to this specific category: marketing collateral for a sales agent, contract review for a conveyancer, entitlement/budget setup for an owners corporation manager.
- Do NOT include architectural design content.`,
  "Marketing & Design": `DEPTH GUIDANCE (Marketing & Design):
- Marketing drawings, renders, finishes boards, and coordination with 3D artists / agencies.`,
};

function mediaTypeFor(fileName: string): string | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return null;
}

// Belt-and-braces: remove any leading stage label the model still emits
// ("Town Planning: ...", "Schematic Design - ...").
const STAGE_LABELS = [
  "schematic",
  "schematic design",
  "schematic review",
  "feasibility",
  "concept",
  "feasibility & concept",
  "feasibility and concept",
  "feasibility / concept",
  "town planning",
  "planning",
  "planning & approval",
  "planning and approval",
  "post-lodgement",
  "post lodgement",
  "design development",
  "marketing",
  "marketing assistance",
  "marketing & design",
  "contract documentation",
  "documentation",
  "construction",
  "construction stage",
  "engineering & delivery",
  "engineering and delivery",
  "delivery",
  "sales/legal & ownership",
  "sales",
  "legal",
  "ownership",
];

function stripStagePrefix(item: string): string {
  const match = item.match(/^([^:–—-]{3,40})\s*[:–—-]\s+(.*)$/);
  if (!match) return item;
  const label = (match[1] ?? "").trim().toLowerCase();
  if (!STAGE_LABELS.includes(label)) return item;
  const rest = (match[2] ?? "").trim();
  if (!rest) return item;
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export const generateScope = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; categoryId: string }) => input)
  .handler(async ({ data, context }): Promise<ScopeResult> => {
    const { supabase } = context;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { status: "not_configured" };

    const { data: project } = await supabase
      .from("projects")
      .select("id, name, address, postcode, project_type, current_phase")
      .eq("id", data.projectId)
      .maybeSingle();

    if (!project) return { status: "failed", message: "Project not found." };

    const { data: category } = await supabase
      .from("consultant_categories")
      .select("id, name")
      .eq("id", data.categoryId)
      .maybeSingle();

    if (!category) return { status: "failed", message: "Category not found." };

    const [{ data: documents }, { data: phases }] = await Promise.all([
      supabase
        .from("project_documents")
        .select("file_name, file_path")
        .eq("project_id", data.projectId),
      supabase
        .from("project_phases")
        .select("phase, started_at")
        .eq("project_id", data.projectId)
        .order("started_at", { ascending: true }),
    ]);

    // Download the actual uploaded documents so the model reads their content,
    // not just their file names.
    const attachments: unknown[] = [];
    const readDocs: string[] = [];
    let budget = 12 * 1024 * 1024; // total bytes sent to the model
    for (const doc of (documents ?? []).slice(0, 8)) {
      const mediaType = mediaTypeFor(doc.file_name);
      if (!mediaType) continue;
      try {
        const { data: blob, error } = await supabase.storage
          .from("project-documents")
          .download(doc.file_path);
        if (error || !blob) continue;
        const bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.byteLength === 0 || bytes.byteLength > budget) continue;
        budget -= bytes.byteLength;
        const base64 = toBase64(bytes);
        attachments.push(
          mediaType === "application/pdf"
            ? {
                type: "input_file",
                filename: doc.file_name,
                file_data: `data:${mediaType};base64,${base64}`,
              }
            : {
                type: "input_image",
                image_url: `data:${mediaType};base64,${base64}`,
              },
        );
        readDocs.push(doc.file_name);
      } catch (error) {
        console.error("Could not read project document", doc.file_path, error);
      }
    }


    const lowerName = category.name.toLowerCase();
    const isSchematic = project.current_phase === "Schematic";
    const reference =
      !isSchematic && lowerName.includes("architect") && !lowerName.includes("landscape")
        ? ARCHITECT_REFERENCE
        : !isSchematic && lowerName.includes("town planner")
          ? PLANNER_REFERENCE
          : "";

    const depthGuidance =
      (project.current_phase && PHASE_DEPTH[project.current_phase]) || "";

    const prompt = [
      "You draft scopes of work that Australian property developers send to consultants when requesting fee proposals.",
      "",
      `Consultant category: ${category.name}`,
      `Project name: ${project.name}`,
      `Site address: ${project.address}${project.postcode ? ` ${project.postcode}` : ""}`,
      project.project_type ? `Project type: ${project.project_type}` : "",
      project.current_phase ? `Current phase: ${project.current_phase}` : "",
      phases && phases.length > 0
        ? `Phases engaged so far: ${phases.map((p) => p.phase).join(", ")}`
        : "",
      readDocs.length > 0
        ? `Attached planning documents (read them and base the scope on what they actually show — drawings, plans, reports, site details): ${readDocs.join(", ")}`
        : documents && documents.length > 0
          ? `Uploaded planning documents (contents unavailable): ${documents.map((d) => d.file_name).join(", ")}`
          : "No planning documents uploaded.",

      "",
      depthGuidance,
      depthGuidance
        ? "The depth guidance above is authoritative — it overrides any broader reference structure below. Do not include work from later stages it excludes."
        : "",
      "",
      reference
        ? `Use the following as a structural and stylistic reference only — include only the parts relevant to this project's current phase, and do not reuse its wording verbatim:\n${reference}`
        : depthGuidance
          ? ""
          : "Write the scope the way an experienced Australian consultant in this discipline would stage their own fee proposal: staged by work phase, each item a concrete deliverable or coordination duty, naming the other consultants and authorities involved.",
      "",
      "Write a dot-point scope of work for this consultant on this project.",
      "Rules:",
      "- Between 6 and 14 items (fewer for early-stage phases).",
      "- Each item is one line, no numbering, no leading bullet character.",
      "- Never prefix an item with a stage or phase label. No 'Town Planning:', 'Schematic:', 'Design Development:' or any similar prefix, and no colon-led labels of any kind. Each item starts directly with the action verb, e.g. 'Prepare the submission drawing set...'.",
      "- Be specific to this project's phase and site. Do not invent facts not implied by the details above.",
      "- Only include stages relevant to where this project is now. Do not include later-stage work.",
      "",
      'Respond with JSON only, in the form {"items": ["...", "..."]}. No commentary.',
    ]
      .filter(Boolean)
      .join("\n");

    let items: string[] = [];
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
          stream: true,
          reasoning: { effort: "low" },
          input: [
            {
              role: "user",
              content: [...attachments, { type: "input_text", text: prompt }],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "scope_of_work",
              strict: true,
              schema: SCOPE_SCHEMA,
            },
          },
        }),
      });

      if (!res.ok) {
        const detail = await res.text();
        console.error("AI gateway error", res.status, detail);
        return {
          status: "failed",
          message:
            res.status === 402
              ? "AI credits have run out for this workspace. Please top up to keep drafting scopes."
              : res.status === 429
                ? "The AI service is busy right now. Please try again in a moment."
                : "The AI service didn't respond. Please try again.",
        };
      }

      const text = await readStreamedText(res);
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? (JSON.parse(match[0]) as { items?: unknown }) : null;
      items = Array.isArray(parsed?.items)
        ? parsed.items
            .map((i) => stripStagePrefix(String(i).replace(/^[-•*\s]+/, "").trim()))
            .filter((i) => i.length > 0)
        : [];
    } catch (error) {
      console.error("generateScope failed", error);
      return { status: "failed", message: "We couldn't draft the scope. Please try again." };
    }

    if (items.length === 0) {
      return { status: "failed", message: "The AI didn't return a usable scope. Please try again." };
    }

    await supabase
      .from("rfq_scope_items")
      .delete()
      .eq("project_id", data.projectId)
      .eq("category_id", data.categoryId)
      .eq("source", "ai_generated");

    const { error: insertError } = await supabase.from("rfq_scope_items").insert(
      items.map((item, index) => ({
        project_id: data.projectId,
        category_id: data.categoryId,
        item_text: item,
        source: "ai_generated",
        position: index,
      })),
    );

    if (insertError) return { status: "failed", message: insertError.message };

    return { status: "ok", items };
  });
