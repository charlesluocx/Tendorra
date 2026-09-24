import Link from "next/link";

type Row = {
  action: string;
  meta: unknown;
  org_id: string | null;
  organizations?: unknown;
  profiles?: unknown;
};

export function describeActivity(a: Row) {
  const who = a.profiles as { email: string; full_name: string | null } | null;
  const org = a.organizations as { name: string } | null;
  const meta = (a.meta ?? {}) as Record<string, unknown>;
  const detail = meta.subject ?? meta.name ?? meta.title ?? meta.email ?? meta.plan ?? meta.tool;
  return (
    <>
      <strong>{who?.full_name ?? who?.email ?? "System"}</strong>{" "}
      <span className="text-slate-600">{a.action.replaceAll(".", " ").replaceAll("_", " ")}</span>
      {detail ? <span className="text-slate-500"> “{String(detail)}”</span> : null}
      {org && a.org_id && (
        <>
          {" "}· <Link className="text-brand-700 hover:underline" href={`/admin/organizations/${a.org_id}`}>{org.name}</Link>
        </>
      )}
    </>
  );
}
