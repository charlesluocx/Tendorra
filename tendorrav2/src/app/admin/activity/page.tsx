import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/format";
import { describeActivity } from "../describe";

export const metadata = { title: "Activity" };
export const dynamic = "force-dynamic";

const PAGE = 100;

export default async function AdminActivity({ searchParams }: { searchParams: Promise<{ org?: string; action?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const db = createAdminClient();

  let query = db
    .from("activity_log")
    .select("id, action, meta, created_at, org_id, organizations(name), profiles(email, full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(page * PAGE, page * PAGE + PAGE - 1);
  if (sp.org && /^[0-9a-f-]{36}$/.test(sp.org)) query = query.eq("org_id", sp.org);
  if (sp.action) query = query.ilike("action", `${sp.action.replace(/[%,()]/g, "")}%`);

  const [{ data: rows, count }, { data: orgs }] = await Promise.all([
    query,
    db.from("organizations").select("id, name").order("name"),
  ]);
  const qs = (p: number) => {
    const params = new URLSearchParams();
    if (sp.org) params.set("org", sp.org);
    if (sp.action) params.set("action", sp.action);
    params.set("page", String(p));
    return `?${params}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Activity log</h1>
          <p className="text-slate-500">{count ?? 0} events</p>
        </div>
        <form className="flex flex-wrap gap-2">
          <select className="input w-auto" name="org" defaultValue={sp.org ?? ""}>
            <option value="">All companies</option>
            {(orgs ?? []).map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
          <select className="input w-auto" name="action" defaultValue={sp.action ?? ""}>
            <option value="">All actions</option>
            {["email", "timeline", "project", "member", "organization", "admin"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <button className="btn-secondary">Filter</button>
        </form>
      </div>
      <div className="card divide-y divide-slate-100 text-sm">
        {(rows ?? []).map((a) => (
          <div key={a.id} className="flex justify-between gap-3 px-4 py-2.5">
            <span className="min-w-0">{describeActivity(a)}</span>
            <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
          </div>
        ))}
        {(rows ?? []).length === 0 && <p className="p-4 text-slate-500">No activity.</p>}
      </div>
      <div className="flex justify-between">
        {page > 0 ? <Link className="btn-secondary" href={qs(page - 1)}>← Newer</Link> : <span />}
        {(count ?? 0) > (page + 1) * PAGE && <Link className="btn-secondary" href={qs(page + 1)}>Older →</Link>}
      </div>
    </div>
  );
}
