"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SyncState } from "@/app/(dashboard)/settings/inbox/actions";

const initialState: SyncState = { error: null, result: null };

export function SyncNowButton({
  action,
  hiddenFields,
}: {
  action: (prevState: SyncState, formData: FormData) => Promise<SyncState>;
  hiddenFields?: Record<string, string>;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      {state.error && <p className="max-w-[220px] text-right text-xs text-destructive">{state.error}</p>}
      {state.result && <p className="max-w-[220px] text-right text-xs text-muted-foreground">{state.result}</p>}
    </form>
  );
}
