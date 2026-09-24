import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatDateTime } from "@/lib/format";
import { describeActivity } from "./describe";

export const dynamic = "force-dynamic";

export default async function AdminOverview() {
  const db = createAdminClient();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const count = (table: string, filter?: (q: any) => any) => {
    let q = db.from(table).select("*", { count: "exact", head: true });
    if (filter) q = filter(q);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };

  const [orgs, users, projects, emails, items, milestones, newUsers, newEmails, recentOrgs, activity] = await Promise.all([
    count("organizations"),
    count("profiles"),
    count("projects"),
    count("emails"),
    count("timeline_items"),
    count("timeline_items", (q) => q.eq("kind", "milestone")),
    count("profiles", (q) => q.gte("created_at", since)),
    count("emails", (q) => q.gte("created_at", since)),
    db.from("organizations").select("id, name, slug, status, plan, created_at, memberships(count), projects(count)").order("created_at", { ascending: false }).limit(8),
    db.from("activity_log").select("id, action, meta, created_at, org_id, organizations(name), profiles(email, full_name)").order("created_at", { ascending: false }).limit(20),
  ]);

  const tiles = [
    ["Companies", orgs],
    ["Users", users, `+${newUsers} in 30 days`],
    ["Projects", projects],
    ["Emails ingested", emails, `+${newEmails} in 30 days`],
    ["Timeline entries", items],
    ["Milestones", milestones],
  ] as const;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Platform overview</h1>
        <p className="text-slate-500">Everything across every company on Tendorra.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {tiles.map(([label, value, sub]) => (
          <div key={label} className="card p-4">
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            <div className="text-sm text-slate-500">{label}</div>
            {sub && <div className="mt-1 text-xs text-emerald-600">{sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Newest companies</h2>
            <Link href="/admin/organizations" className="text-sm text-brand-600">All →</Link>
          </div>
          <table className="table">
            <thead><tr><th>Company</th><th>Staff</th><th>Projects</th><th>Created</th></tr></thead>
            <tbody>
              {(recentOrgs.data ?? []).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/organizations/${o.id}`} className="font-medium text-brand-700 hover:underline">{o.name}</Link>
                    {o.status === "suspended" && <span className="badge ml-2 bg-red-50 text-red-700">Suspended</span>}
                  </td>
                  <td>{(o.memberships as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td>{(o.projects as unknown as { count: number }[])[0]?.count ?? 0}</td>
                  <td className="text-slate-500">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <h2 className="font-semibold">Live activity</h2>
            <Link href="/admin/activity" className="text-sm text-brand-600">All →</Link>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex justify-between gap-3 px-4 py-2.5">
                <span className="min-w-0">{describeActivity(a)}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
