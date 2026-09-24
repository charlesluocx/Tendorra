/**
 * Tool catalog. Every tool on the platform is registered here; organizations
 * switch tools on/off in Settings (stored in the org_tools table).
 *
 * To add a new tool:
 *   1. Add an entry below with a unique `key`.
 *   2. Build its pages under src/app/o/[slug]/<key>/.
 *   3. Add any tables in a new supabase/migrations file (always with org_id + RLS).
 */
export type ToolDefinition = {
  key: string;
  name: string;
  tagline: string;
  description: string;
  icon: string; // emoji keeps the catalog dependency-free
  status: "live" | "coming_soon";
  defaultEnabled: boolean;
};

export const TOOLS: ToolDefinition[] = [
  {
    key: "timeline",
    name: "Project Timeline",
    tagline: "Drag in emails, get a living project history.",
    description:
      "Drop emails from Outlook or Gmail onto a project. Claude reads each one, logs what happened, and flags major milestones on a visual timeline.",
    icon: "🗓️",
    status: "live",
    defaultEnabled: true,
  },
  {
    key: "documents",
    name: "Document Register",
    tagline: "Drawings, reports and approvals in one place.",
    description: "Track document revisions, transmittals and approvals per project.",
    icon: "📁",
    status: "coming_soon",
    defaultEnabled: false,
  },
  {
    key: "consultants",
    name: "Consultants & RFQs",
    tagline: "Request quotes and compare consultants.",
    description: "Manage consultant contacts, send RFQs and compare returned quotes.",
    icon: "🤝",
    status: "coming_soon",
    defaultEnabled: false,
  },
  {
    key: "budget",
    name: "Budget Tracker",
    tagline: "Feasibility to final account.",
    description: "Track project budget, commitments and actual spend against forecast.",
    icon: "💰",
    status: "coming_soon",
    defaultEnabled: false,
  },
];

export function getTool(key: string) {
  return TOOLS.find((t) => t.key === key);
}
