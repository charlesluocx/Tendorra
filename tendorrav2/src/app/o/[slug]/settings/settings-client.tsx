"use client";

import { useActionState, useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";
import { changeRole, inviteMember, removeMember, renameOrg, revokeInvite, toggleTool, type InviteState } from "./actions";

export function RenameForm({ slug, name }: { slug: string; name: string }) {
  const [state, action] = useActionState(renameOrg.bind(null, slug), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1">
        <label className="label" htmlFor="org-name">Company name</label>
        <input id="org-name" className="input" name="name" defaultValue={name} required />
      </div>
      <SubmitButton>Save</SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

export function InviteForm({ slug }: { slug: string }) {
  const [state, action] = useActionState<InviteState, FormData>(inviteMember.bind(null, slug), undefined);
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-3">
      <form action={action} className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label className="label" htmlFor="invite-email">Email</label>
          <input id="invite-email" className="input" name="email" type="email" placeholder="colleague@company.com" required />
        </div>
        <div>
          <label className="label" htmlFor="invite-role">Role</label>
          <select id="invite-role" className="input" name="role" defaultValue="member">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <SubmitButton pendingText="Inviting…">Create invite</SubmitButton>
      </form>
      <FormMessage state={state} />
      {state?.link && (
        <div className="flex gap-2">
          <input className="input font-mono text-xs" readOnly value={state.link} onFocus={(e) => e.target.select()} />
          <button
            className="btn-secondary"
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.link!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

export function MemberRow({
  slug,
  member,
  isSelf,
}: {
  slug: string;
  member: { user_id: string; role: string; name: string; email: string; joined: string };
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const locked = member.role === "owner" || isSelf;
  return (
    <tr>
      <td>
        <div className="font-medium">{member.name}{isSelf && <span className="ml-1 text-xs text-slate-400">(you)</span>}</div>
        <div className="text-xs text-slate-500">{member.email}</div>
      </td>
      <td>
        {locked ? (
          <span className="capitalize">{member.role}</span>
        ) : (
          <select
            className="input w-auto py-1"
            value={member.role}
            disabled={pending}
            onChange={(e) => start(() => changeRole(slug, member.user_id, e.target.value as "admin" | "member"))}
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
        )}
      </td>
      <td className="text-slate-500">{member.joined}</td>
      <td className="text-right">
        {!locked && (
          <button
            className="btn-ghost px-2 py-1 text-xs text-red-600"
            disabled={pending}
            onClick={() => confirm(`Remove ${member.email} from this workspace?`) && start(() => removeMember(slug, member.user_id))}
          >
            Remove
          </button>
        )}
      </td>
    </tr>
  );
}

export function RevokeButton({ slug, id }: { slug: string; id: string }) {
  const [pending, start] = useTransition();
  return (
    <button className="btn-ghost px-2 py-1 text-xs text-red-600" disabled={pending} onClick={() => start(() => revokeInvite(slug, id))}>
      Revoke
    </button>
  );
}

export function ToolToggle({ slug, toolKey, enabled, disabled }: { slug: string; toolKey: string; enabled: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled || pending}
      onClick={() => start(() => toggleTool(slug, toolKey, !enabled))}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${enabled ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${enabled ? "translate-x-5" : ""}`} />
    </button>
  );
}
