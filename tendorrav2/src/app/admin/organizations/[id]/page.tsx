import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { TOOLS } from "@/lib/tools/registry";
import { formatDate, formatDateTime } from "@/lib/format";
import { AdminToolToggle, OrgPlanForm, OrgStatusButton } from "../../admin-controls";
import { describeActivity } from "../../describe";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = createAdminClient();

  const [{ data: org }, { data: members }, { data: projects }, { data: invites }, { data: tools }, { data: activity }] = await Promise.all([
    db.from("organizations").select("*").eq("id", id).maybeSingle(),
    db.from("memberships").select("user_id, role, created_at, profiles(email, full_name)").eq("org_id", id).order("created_at"),
    db
      .from("projects")
      .select("id, name, code, status, created_at, updated_at, emails(count), timeline_items(kind, milestone_status)")
      .eq("org_id", id)
      .order("updated_at", { ascending: false }),
    db.from("invitations").select("id, email, role, accepted_at, expires_at, created_at").eq("org_id", id).order("created_at", { ascending: false }),
    db.from("org_tools").select("tool_key, enabled").eq("org_id", id),
    db.from("activity_log").select("id, action, meta, created_at, org_id, profiles(email, full_name)").eq("org_id", id).order("created_at", { ascending: false }).limit(40),
  ]);
  if (!org) notFound();
  const enabled = new Map((tools ?? []).map((t) => [t.tool_key, t.enabled]));

  return (
    <div className="space-y-6">
      <Link href="/admin/organizations" className="text-sm text-slate-500 hover:text-slate-800">← Companies</Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            {org.name}
            <span className={`badge ml-3 align-middle ${org.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{org.status}</span>
          </h1>
          <p className="text-sm text-slate-500">/o/{org.slug} · created {formatDate(org.created_at)} · id {org.id}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <OrgPlanForm orgId={org.id} plan={org.plan} />
          <OrgStatusButton orgId={org.id} status={org.status} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="p-4 font-semibold">Projects ({projects?.length ?? 0})</h2>
          <table className="table">
            <thead><tr><th>Project</th><th>Status</th><th>Emails</th><th>Entries</th><th>Milestones</th><th>Updated</th></tr></thead>
            <tbody>
              {(projects ?? []).map((p) => {
                const items = p.timeline_items as unknown as { kind: string; milestone_status: string | null }[];
                const ms = items.filter((i) => i.kind === "milestone");
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/admin/projects/${p.id}`} className="font-medium text-brand-700 hover:underline">{p.name}</Link>
                      {p.code && <div className="text-xs text-slate-400">{p.code}</div>}
                    </td>
                    <td className="capitalize">{p.status.replace("_", " ")}</td>
                    <td>{(p.emails as unknown as { count: number }[])[0]?.count ?? 0}</td>
                    <td>{items.length}</td>
                    <td>{ms.filter((m) => m.milestone_status === "achieved").length}/{ms.length}</td>
                    <td className="text-slate-500">{formatDate(p.updated_at)}</td>
                  </tr>
                );
              })}
              {(projects ?? []).length === 0 && (
                <tr><td colSpan={6} className="text-center text-slate-500">No projects yet.</td></tr>
              )}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Tools</h2>
          <ul className="space-y-3">
            {TOOLS.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{t.icon} {t.name}{t.status === "coming_soon" && <span className="ml-1 text-xs text-slate-400">(soon)</span>}</span>
                <AdminToolToggle orgId={org.id} toolKey={t.key} enabled={Boolean(enabled.get(t.key))} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-400">Admins can pre-enable “coming soon” tools for early access.</p>
        </section>

        <section className="card overflow-hidden lg:col-span-2">
          <h2 className="p-4 font-semibold">Staff ({members?.length ?? 0})</h2>
          <table className="table">
            <thead><tr><th>Person</th><th>Role</th><th>Joined</th></tr></thead>
            <tbody>
              {(members ?? []).map((m) => {
                const p = m.profiles as unknown as { email: string; full_name: string | null };
                return (
                  <tr key={m.user_id}>
                    <td>
                      <div className="font-medium">{p?.full_name ?? p?.email}</div>
                      <div className="text-xs text-slate-500">{p?.email}</div>
                    </td>
                    <td className="capitalize">{m.role}</td>
                    <td className="text-slate-500">{formatDate(m.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="card p-4">
          <h2 className="mb-3 font-semibold">Invitations</h2>
          <ul className="space-y-2 text-sm">
            {(invites ?? []).map((i) => (
              <li key={i.id} className="flex justify-between gap-2">
                <span className="truncate">{i.email} <span className="text-xs text-slate-400">({i.role})</span></span>
                <span className="shrink-0 text-xs text-slate-500">
                  {i.accepted_at ? "accepted" : new Date(i.expires_at) < new Date() ? "expired" : "pending"}
                </span>
              </li>
            ))}
            {(invites ?? []).length === 0 && <li className="text-slate-500">None</li>}
          </ul>
        </section>

        <section className="card overflow-hidden lg:col-span-3">
          <h2 className="p-4 font-semibold">Activity</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {(activity ?? []).map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">{describeActivity({ ...a, organizations: null })}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
            {(activity ?? []).length === 0 && <li className="px-4 py-3 text-slate-500">No activity.</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
