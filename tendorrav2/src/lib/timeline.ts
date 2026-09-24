export const CATEGORIES = [
  "design",
  "planning_approval",
  "procurement",
  "contract",
  "construction",
  "finance",
  "legal",
  "meeting",
  "correspondence",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  design: "Design",
  planning_approval: "Planning & approvals",
  procurement: "Procurement",
  contract: "Contract",
  construction: "Construction",
  finance: "Finance",
  legal: "Legal",
  meeting: "Meeting",
  correspondence: "Correspondence",
  other: "Other",
};

/** Dot colours for events on the chart, per category. */
export const CATEGORY_COLORS: Record<Category, string> = {
  design: "#8b5cf6",
  planning_approval: "#0ea5e9",
  procurement: "#f59e0b",
  contract: "#6366f1",
  construction: "#f97316",
  finance: "#10b981",
  legal: "#64748b",
  meeting: "#ec4899",
  correspondence: "#94a3b8",
  other: "#a8a29e",
};

export function categoryLabel(c: string | null | undefined) {
  return CATEGORY_LABELS[(c ?? "other") as Category] ?? "Other";
}
export function categoryColor(c: string | null | undefined) {
  return CATEGORY_COLORS[(c ?? "other") as Category] ?? CATEGORY_COLORS.other;
}

export type MilestoneStatus = "planned" | "achieved" | "missed";

export const MILESTONE_STYLES: Record<MilestoneStatus, { label: string; fill: string; stroke: string; badge: string }> = {
  achieved: { label: "Achieved", fill: "#10b981", stroke: "#047857", badge: "bg-emerald-50 text-emerald-700" },
  planned: { label: "Planned", fill: "#ffffff", stroke: "#2f6fed", badge: "bg-blue-50 text-blue-700" },
  missed: { label: "Missed", fill: "#ef4444", stroke: "#b91c1c", badge: "bg-red-50 text-red-700" },
};

export type TimelineItem = {
  id: string;
  kind: "event" | "milestone";
  milestone_status: MilestoneStatus | null;
  title: string;
  summary: string | null;
  category: string | null;
  occurred_at: string;
  ai_generated: boolean;
  email_id: string | null;
};

export type EmailRecord = {
  id: string;
  subject: string | null;
  from_name: string | null;
  from_address: string | null;
  to_addresses: string[];
  sent_at: string | null;
  ai_summary: string | null;
  body_text: string | null;
  file_name: string | null;
  source_format: "eml" | "msg" | "text";
  attachments: { name: string; size: number | null }[];
  storage_path: string | null;
  created_at: string;
};
