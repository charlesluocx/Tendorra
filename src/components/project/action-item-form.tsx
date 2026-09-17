"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createActionItem, type FormState } from "@/app/(dashboard)/projects/[id]/actions";

const initialState: FormState = { error: null };

export function ActionItemForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createActionItem, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap gap-2">
      <input type="hidden" name="project_id" value={projectId} />
      <Input name="title" placeholder="New action item…" required className="min-w-[200px] flex-1" />
      <Input name="due_date" type="date" className="w-40" />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      {state.error && (
        <p className="w-full text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
