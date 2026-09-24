import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePlatformAdmin } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import { PlatformAdminToggle } from "../admin-controls";

export const metadata = { title: "Users" };
export const dynamic = "force-dynamic";

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const me = await requirePlatformAdmin();
  const { q } = await searchParams;
  const db = createAdminClient();

  let query = db
    .from("profiles")
    .select("id, email, full_name, is_platform_admin, created_at, memberships(role, organizations(id, name))")
    .order("created_at", { ascending: false })
    .limit(500);
  if (q) {
    const term = q.replace(/[%,()]/g, "");
    query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }
  const [{ data: users }, authList] = await Promise.all([query, db.auth.admin.listUsers({ perPage: 1000 })]);
  const authById = new Map((authList.data?.users ?? []).map((u) => [u.id, u]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-slate-500">{users?.length ?? 0} people</p>
        </div>
        <form className="flex gap-2">
          <input className="input w-64" name="q" defaultValue={q} placeholder="Search name or email…" />
          <button className="btn-secondary">Search</button>
        </form>
      </div>
      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>User</th><th>Companies</th><th>Signed up</th><th>Last sign-in</th><th>Email confirmed</th><th>Access</th></tr></thead>
          <tbody>
            {(users ?? []).map((u) => {
              const auth = authById.get(u.id);
              const memberships = u.memberships as unknown as { role: string; organizations: { id: string; name: string } }[];
              return (
                <tr key={u.id}>
                  <td>
                    <div className="font-medium">{u.full_name ?? "—"}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="text-xs">
                    {memberships.length === 0 && <span className="text-slate-400">No company</span>}
                    {memberships.map((m) => (
                      <div key={m.organizations.id}>
                        <Link className="text-brand-700 hover:underline" href={`/admin/organizations/${m.organizations.id}`}>{m.organizations.name}</Link>{" "}
                        <span className="text-slate-400">({m.role})</span>
                      </div>
                    ))}
                  </td>
                  <td className="text-slate-500">{formatDate(u.created_at)}</td>
                  <td className="text-slate-500">{formatDateTime(auth?.last_sign_in_at)}</td>
                  <td>{auth?.email_confirmed_at ? "✅" : <span className="text-xs text-amber-600">pending</span>}</td>
                  <td><PlatformAdminToggle userId={u.id} value={u.is_platform_admin} isSelf={u.id === me.id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
