import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default async function AdminOrganizations({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const db = createAdminClient();
  let query = db
    .from("organizations")
    .select("id, name, slug, status, plan, created_at, memberships(count), projects(count), emails(count), profiles:created_by(email)")
    .order("created_at", { ascending: false });
  if (q) query = query.or(`name.ilike.%${q.replace(/[%,()]/g, "")}%,slug.ilike.%${q.replace(/[%,()]/g, "")}%`);
  if (status === "active" || status === "suspended") query = query.eq("status", status);
  const { data: orgs, error } = await query;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-slate-500">{orgs?.length ?? 0} workspaces</p>
        </div>
        <form className="flex gap-2">
          <input className="input w-56" name="q" defaultValue={q} placeholder="Search name or URL…" />
          <select className="input w-auto" name="status" defaultValue={status ?? ""}>
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
      </div>
      {error && <p className="text-sm text-red-600">{error.message}</p>}
      <div className="card overflow-x-auto">
        <table className="table">
          <thead>
            <tr><th>Company</th><th>Status</th><th>Plan</th><th>Staff</th><th>Projects</th><th>Emails</th><th>Owner</th><th>Created</th></tr>
          </thead>
          <tbody>
            {(orgs ?? []).map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/organizations/${o.id}`} className="font-medium text-brand-700 hover:underline">{o.name}</Link>
                  <div className="text-xs text-slate-400">/o/{o.slug}</div>
                </td>
                <td>
                  <span className={`badge ${o.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>{o.status}</span>
                </td>
                <td className="capitalize">{o.plan}</td>
                <td>{(o.memberships as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td>{(o.projects as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td>{(o.emails as unknown as { count: number }[])[0]?.count ?? 0}</td>
                <td className="text-xs text-slate-500">{(o.profiles as unknown as { email: string } | null)?.email ?? "—"}</td>
                <td className="text-slate-500">{formatDate(o.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
