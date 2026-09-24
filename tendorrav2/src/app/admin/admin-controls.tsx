"use client";

import { useState, useTransition } from "react";
import { setOrgPlan, setOrgStatus, setOrgTool, setPlatformAdmin } from "./actions";

export function OrgStatusButton({ orgId, status }: { orgId: string; status: "active" | "suspended" }) {
  const [pending, start] = useTransition();
  return status === "active" ? (
    <button
      className="btn-danger"
      disabled={pending}
      onClick={() => confirm("Suspend this company? Its staff will lose access immediately.") && start(() => setOrgStatus(orgId, "suspended"))}
    >
      Suspend company
    </button>
  ) : (
    <button className="btn-primary" disabled={pending} onClick={() => start(() => setOrgStatus(orgId, "active"))}>
      Reactivate company
    </button>
  );
}

export function OrgPlanForm({ orgId, plan }: { orgId: string; plan: string }) {
  const [value, setValue] = useState(plan);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-2">
      <select className="input w-auto py-1.5" value={value} onChange={(e) => setValue(e.target.value)}>
        {["free", "starter", "pro", "enterprise"].map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
      <button className="btn-secondary" disabled={pending || value === plan} onClick={() => start(() => setOrgPlan(orgId, value))}>
        Save plan
      </button>
    </div>
  );
}

export function AdminToolToggle({ orgId, toolKey, enabled }: { orgId: string; toolKey: string; enabled: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={pending}
      onClick={() => start(() => setOrgTool(orgId, toolKey, !enabled))}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${enabled ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}

export function PlatformAdminToggle({ userId, value, isSelf }: { userId: string; value: boolean; isSelf: boolean }) {
  const [pending, start] = useTransition();
  return (
    <label className="inline-flex items-center gap-2 text-xs">
      <input
        type="checkbox"
        checked={value}
        disabled={pending || isSelf}
        onChange={(e) => {
          const next = e.target.checked;
          if (next && !confirm("Give this user full platform admin access (all companies' data)?")) return;
          start(() => setPlatformAdmin(userId, next));
        }}
      />
      Platform admin
    </label>
  );
}
