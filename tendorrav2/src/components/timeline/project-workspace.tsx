"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MILESTONE_STYLES,
  categoryColor,
  categoryLabel,
  type EmailRecord,
  type MilestoneStatus,
  type TimelineItem,
} from "@/lib/timeline";
import { formatBytes, formatDate, formatDateTime, formatMonthYear } from "@/lib/format";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { TimelineChart } from "./timeline-chart";
import {
  deleteEmail,
  deleteTimelineItem,
  getEmailDownloadUrl,
  saveTimelineItem,
  setMilestone,
} from "@/app/o/[slug]/timeline/actions";

type Filter = "all" | "milestones" | "events";

function toDateInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function ItemEditor({
  slug,
  projectId,
  item,
  onDone,
}: {
  slug: string;
  projectId: string;
  item?: TimelineItem;
  onDone: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: Parameters<typeof saveTimelineItem>[3], fd: FormData) => {
      const res = await saveTimelineItem(slug, projectId, item?.id ?? null, prev, fd);
      if (res?.success) onDone();
      return res;
    },
    undefined,
  );
  const [kind, setKind] = useState<"event" | "milestone">(item?.kind ?? "event");
  const [date, setDate] = useState(item ? toDateInput(item.occurred_at) : toDateInput(new Date().toISOString()));
  // Keep the original time of day when only the date is edited; new entries default to midday local time.
  const time = item ? new Date(item.occurred_at).toTimeString().slice(0, 5) : "12:00";
  const iso = date ? new Date(`${date}T${time}`).toISOString() : "";

  return (
    <form action={action} className="grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-6">
      <input type="hidden" name="occurred_at" value={iso} />
      <div className="sm:col-span-4">
        <label className="label">Title</label>
        <input className="input" name="title" defaultValue={item?.title} required />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Date</label>
        <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Type</label>
        <select className="input" name="kind" value={kind} onChange={(e) => setKind(e.target.value as "event" | "milestone")}>
          <option value="event">Event</option>
          <option value="milestone">Milestone</option>
        </select>
      </div>
      {kind === "milestone" ? (
        <div className="sm:col-span-2">
          <label className="label">Milestone status</label>
          <select className="input" name="milestone_status" defaultValue={item?.milestone_status ?? "achieved"}>
            <option value="achieved">Achieved</option>
            <option value="planned">Planned</option>
            <option value="missed">Missed</option>
          </select>
        </div>
      ) : (
        <div className="hidden sm:col-span-2 sm:block" />
      )}
      <div className="sm:col-span-2">
        <label className="label">Category</label>
        <select className="input" name="category" defaultValue={item?.category ?? "other"}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-6">
        <label className="label">Summary</label>
        <textarea className="input" rows={2} name="summary" defaultValue={item?.summary ?? ""} />
      </div>
      <div className="flex items-center gap-2 sm:col-span-6">
        <SubmitButton pendingText="Saving…">{item ? "Save changes" : "Add entry"}</SubmitButton>
        <button type="button" className="btn-ghost" onClick={onDone}>Cancel</button>
        <FormMessage state={state?.error ? state : undefined} />
      </div>
    </form>
  );
}

const monthKey = formatMonthYear;

export function ProjectWorkspace({
  slug,
  projectId,
  items,
  emails,
  startDate,
  targetDate,
}: {
  slug: string;
  projectId: string;
  items: TimelineItem[];
  emails: EmailRecord[];
  startDate: string | null;
  targetDate: string | null;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const [tab, setTab] = useState<"timeline" | "emails">("timeline");
  const [pending, startTransition] = useTransition();

  const emailById = useMemo(() => new Map(emails.map((e) => [e.id, e])), [emails]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (filter === "all" ? true : filter === "milestones" ? i.kind === "milestone" : i.kind === "event"))
      .filter((i) => category === "all" || (i.category ?? "other") === category)
      .filter((i) => !q || `${i.title} ${i.summary ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  }, [items, filter, category, search]);

  const groups = useMemo(() => {
    const map = new Map<string, TimelineItem[]>();
    for (const i of visible) {
      const k = monthKey(i.occurred_at);
      map.set(k, [...(map.get(k) ?? []), i]);
    }
    return [...map.entries()];
  }, [visible]);

  const milestones = items.filter((i) => i.kind === "milestone");
  const stats = {
    events: items.length - milestones.length,
    achieved: milestones.filter((m) => m.milestone_status === "achieved").length,
    planned: milestones.filter((m) => m.milestone_status === "planned").length,
    missed: milestones.filter((m) => m.milestone_status === "missed").length,
  };
  const nextPlanned = milestones
    .filter((m) => m.milestone_status === "planned" && m.occurred_at >= new Date().toISOString())
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at))[0];

  const selectItem = (id: string) => {
    setTab("timeline");
    setFilter("all");
    setCategory("all");
    setSearch("");
    setHighlight(id);
    requestAnimationFrame(() => document.getElementById(`item-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
    setTimeout(() => setHighlight(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          ["Events", stats.events, "text-slate-900"],
          ["Achieved", stats.achieved, "text-emerald-600"],
          ["Planned", stats.planned, "text-blue-600"],
          ["Missed", stats.missed, "text-red-600"],
          ["Emails", emails.length, "text-slate-900"],
        ].map(([label, value, color]) => (
          <div key={label as string} className="card px-4 py-3">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500">{label}</div>
          </div>
        ))}
      </div>

      {nextPlanned && (
        <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-800">
          Next milestone: <strong>{nextPlanned.title}</strong> on {formatDate(nextPlanned.occurred_at)}
        </div>
      )}

      <TimelineChart items={items} startDate={startDate} targetDate={targetDate} onSelect={selectItem} />

      <div className="flex gap-1 border-b border-slate-200">
        {(["timeline", "emails"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize ${
              tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t === "timeline" ? `History (${items.length})` : `Emails (${emails.length})`}
          </button>
        ))}
      </div>

      {tab === "timeline" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
              {(["all", "milestones", "events"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1 capitalize ${filter === f ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            <select className="input w-auto py-1.5" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
            <input className="input w-48 py-1.5" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div className="flex-1" />
            <button className="btn-secondary" onClick={() => setAdding((v) => !v)}>+ Add entry manually</button>
          </div>

          {adding && <ItemEditor slug={slug} projectId={projectId} onDone={() => setAdding(false)} />}

          {groups.length === 0 && (
            <p className="py-8 text-center text-sm text-slate-500">
              {items.length ? "Nothing matches these filters." : "No history yet. Drag an email into the drop zone above."}
            </p>
          )}

          {groups.map(([month, list]) => (
            <section key={month}>
              <h3 className="sticky top-0 z-[1] bg-slate-50/90 py-1 text-xs font-semibold tracking-wide text-slate-500 uppercase backdrop-blur">
                {month}
              </h3>
              <ol className="relative mt-2 space-y-3 border-l-2 border-slate-200 pl-6">
                {list.map((item) => {
                  const email = item.email_id ? emailById.get(item.email_id) : undefined;
                  const ms = item.milestone_status as MilestoneStatus | null;
                  return (
                    <li key={item.id} id={`item-${item.id}`} className="relative">
                      {item.kind === "milestone" ? (
                        <span
                          className="absolute top-4 -left-[33px] h-3.5 w-3.5 rotate-45"
                          style={{ background: MILESTONE_STYLES[ms ?? "planned"].fill, border: `2px solid ${MILESTONE_STYLES[ms ?? "planned"].stroke}` }}
                        />
                      ) : (
                        <span className="absolute top-4 -left-[31px] h-3 w-3 rounded-full border-2 border-white" style={{ background: categoryColor(item.category) }} />
                      )}
                      {editing === item.id ? (
                        <ItemEditor slug={slug} projectId={projectId} item={item} onDone={() => setEditing(null)} />
                      ) : (
                        <div className={`card p-4 transition ${highlight === item.id ? "ring-2 ring-brand-500" : ""} ${item.kind === "milestone" ? "border-l-4" : ""}`}
                          style={item.kind === "milestone" ? { borderLeftColor: MILESTONE_STYLES[ms ?? "planned"].stroke } : undefined}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-semibold">{item.title}</h4>
                                {item.kind === "milestone" && ms && (
                                  <span className={`badge ${MILESTONE_STYLES[ms].badge}`}>🏁 {MILESTONE_STYLES[ms].label}</span>
                                )}
                                <span className="badge bg-slate-100 text-slate-600">{categoryLabel(item.category)}</span>
                                {item.ai_generated && <span className="badge bg-violet-50 text-violet-700" title="Extracted by Claude">AI</span>}
                              </div>
                              <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(item.occurred_at)}</p>
                              {item.summary && <p className="mt-2 text-sm text-slate-700">{item.summary}</p>}
                              {email && (
                                <button
                                  className="mt-2 text-xs text-brand-600 hover:underline"
                                  onClick={() => {
                                    setTab("emails");
                                    setOpenEmail(email.id);
                                  }}
                                >
                                  ✉ {email.subject} — {email.from_name ?? email.from_address}
                                </button>
                              )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <select
                                className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-600"
                                value={item.kind === "milestone" ? (ms ?? "planned") : "event"}
                                disabled={pending}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  startTransition(() =>
                                    setMilestone(slug, projectId, item.id, v === "event" ? null : (v as MilestoneStatus)),
                                  );
                                }}
                                title="Mark as milestone"
                              >
                                <option value="event">Event</option>
                                <option value="achieved">🏁 Achieved</option>
                                <option value="planned">🏁 Planned</option>
                                <option value="missed">🏁 Missed</option>
                              </select>
                              <button className="btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(item.id)}>Edit</button>
                              <button
                                className="btn-ghost px-2 py-1 text-xs text-red-600"
                                disabled={pending}
                                onClick={() => {
                                  if (confirm("Delete this entry?")) startTransition(() => deleteTimelineItem(slug, projectId, item.id));
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}

      {tab === "emails" && (
        <div className="card divide-y divide-slate-100">
          {emails.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No emails yet.</p>}
          {emails.map((email) => {
            const open = openEmail === email.id;
            const linked = items.filter((i) => i.email_id === email.id);
            return (
              <div key={email.id}>
                <button className="flex w-full items-start justify-between gap-4 px-5 py-3 text-left hover:bg-slate-50" onClick={() => setOpenEmail(open ? null : email.id)}>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{email.subject || "(no subject)"}</div>
                    <div className="truncate text-xs text-slate-500">
                      {email.from_name ?? ""} {email.from_address ? `<${email.from_address}>` : ""}
                    </div>
                    {email.ai_summary && <div className="mt-1 line-clamp-2 text-sm text-slate-600">{email.ai_summary}</div>}
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-500">
                    <div>{formatDate(email.sent_at ?? email.created_at)}</div>
                    <div className="uppercase">{email.source_format}</div>
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 bg-slate-50 px-5 py-4 text-sm">
                    <div className="grid gap-1 text-xs text-slate-600">
                      <div><strong>To:</strong> {email.to_addresses.join(", ") || "—"}</div>
                      <div><strong>Sent:</strong> {formatDateTime(email.sent_at)}</div>
                      {email.attachments.length > 0 && (
                        <div>
                          <strong>Attachments:</strong>{" "}
                          {email.attachments.map((a) => `${a.name}${a.size ? ` (${formatBytes(a.size)})` : ""}`).join(", ")}
                        </div>
                      )}
                      <div><strong>Timeline entries:</strong> {linked.length ? linked.map((l) => l.title).join("; ") : "none"}</div>
                    </div>
                    <pre className="max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-sans text-sm whitespace-pre-wrap">
                      {email.body_text || "(empty)"}
                    </pre>
                    <div className="flex gap-2">
                      {email.storage_path && (
                        <button
                          className="btn-secondary"
                          onClick={async () => {
                            const url = await getEmailDownloadUrl(slug, email.id);
                            if (url) window.location.href = url;
                          }}
                        >
                          Download original
                        </button>
                      )}
                      <button
                        className="btn-danger"
                        disabled={pending}
                        onClick={() => {
                          if (!confirm("Remove this email?")) return;
                          const withItems = linked.length > 0 && confirm(`Also delete the ${linked.length} timeline entr${linked.length === 1 ? "y" : "ies"} created from it?`);
                          startTransition(() => deleteEmail(slug, projectId, email.id, withItems));
                        }}
                      >
                        Remove email
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
