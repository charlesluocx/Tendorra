"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { addManualUpdate, type FormState } from "@/app/(dashboard)/projects/[id]/actions";

const initialState: FormState = { error: null };

export function ManualUpdateForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addManualUpdate, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="flex gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <Textarea
        name="summary"
        rows={1}
        placeholder="Post a quick update to the feed…"
        required
        className="min-h-9 resize-none"
      />
      <Button type="submit" size="sm" disabled={pending} className="shrink-0">
        {pending ? "Posting…" : "Post"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
