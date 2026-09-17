"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inviteEmployee, type InviteState } from "@/app/(dashboard)/settings/team/actions";

const initialState: InviteState = { error: null };

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteEmployee, initialState);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  return (
    <form action={action} className="flex flex-wrap items-start gap-2">
      <input type="hidden" name="origin" value={origin} />
      <Input name="email" type="email" placeholder="teammate@company.com" required className="min-w-[220px] flex-1" />
      <select
        name="role"
        defaultValue="member"
        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
      >
        <option value="member">Member</option>
        <option value="admin">Admin</option>
      </select>
      <Button type="submit" size="sm" disabled={pending || !origin}>
        {pending ? "Sending…" : "Invite"}
      </Button>
      {state.error && <p className="w-full text-sm text-destructive">{state.error}</p>}
      {state.inviteUrl && (
        <div className="w-full rounded-md border border-border bg-muted/40 p-3 text-xs">
          <p className="text-foreground">Share this link with them — no email was sent:</p>
          <p className="mt-1 break-all text-muted-foreground">{state.inviteUrl}</p>
        </div>
      )}
    </form>
  );
}
