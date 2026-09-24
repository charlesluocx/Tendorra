"use client";

import { useRouter } from "next/navigation";

export function OrgSwitcher({
  current,
  orgs,
}: {
  current: string;
  orgs: { slug: string; name: string }[];
}) {
  const router = useRouter();
  if (orgs.length <= 1) {
    return <div className="truncate px-1 text-sm font-semibold text-slate-800">{orgs[0]?.name}</div>;
  }
  return (
    <select
      className="input py-1.5 font-semibold"
      value={current}
      onChange={(e) => router.push(e.target.value === "__new" ? "/onboarding" : `/o/${e.target.value}`)}
    >
      {orgs.map((o) => (
        <option key={o.slug} value={o.slug}>{o.name}</option>
      ))}
      <option value="__new">+ New workspace…</option>
    </select>
  );
}
