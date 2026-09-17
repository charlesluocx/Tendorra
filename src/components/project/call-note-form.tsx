"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addCallNote, type FormState } from "@/app/(dashboard)/projects/[id]/actions";

const initialState: FormState = { error: null };

export function CallNoteForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(addCallNote, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={action} className="space-y-3 rounded-md border border-border bg-muted/20 p-4">
      <input type="hidden" name="project_id" value={projectId} />
      <div className="space-y-2">
        <Label htmlFor="note_text">Log a call</Label>
        <Textarea
          id="note_text"
          name="note_text"
          rows={3}
          placeholder="Who you spoke to and what was agreed…"
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="participants">Participants (optional)</Label>
          <Input id="participants" name="participants" placeholder="e.g. Jane (builder), Sam" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="call_date">When (optional, defaults to now)</Label>
          <Input id="call_date" name="call_date" type="datetime-local" />
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Log call"}
        </Button>
      </div>
    </form>
  );
}
