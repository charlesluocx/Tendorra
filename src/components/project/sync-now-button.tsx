"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { SyncState } from "@/app/(dashboard)/settings/inbox/actions";

const initialState: SyncState = { error: null, result: null };

export function SyncNowButton({ action }: { action: (prevState: SyncState, formData: FormData) => Promise<SyncState> }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      {state.error && <p className="max-w-[220px] text-right text-xs text-destructive">{state.error}</p>}
      {state.result && <p className="max-w-[220px] text-right text-xs text-muted-foreground">{state.result}</p>}
    </form>
  );
}
