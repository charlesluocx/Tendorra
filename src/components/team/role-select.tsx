"use client";

import { useRef } from "react";
import { updateMemberRole } from "@/app/(dashboard)/settings/team/actions";

export function RoleSelect({ memberId, role, disabled }: { memberId: string; role: string; disabled?: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={updateMemberRole}>
      <input type="hidden" name="member_id" value={memberId} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground disabled:opacity-60"
      >
        <option value="owner">Owner</option>
        <option value="admin">Admin</option>
        <option value="member">Member</option>
      </select>
    </form>
  );
}
