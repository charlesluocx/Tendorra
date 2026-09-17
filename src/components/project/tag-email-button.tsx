"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { tagEmail, type TagEmailState } from "@/app/(dashboard)/projects/[id]/inbox/actions";

const initialState: TagEmailState = { error: null };

export function TagEmailButton(props: {
  projectId: string;
  connectionId: string;
  messageId: string;
  subject: string;
  fromAddress: string;
  receivedAt: string;
  bodyPreview: string;
}) {
  const [state, action, pending] = useActionState(tagEmail, initialState);

  return (
    <form action={action} className="shrink-0 text-right">
      <input type="hidden" name="project_id" value={props.projectId} />
      <input type="hidden" name="connection_id" value={props.connectionId} />
      <input type="hidden" name="message_id" value={props.messageId} />
      <input type="hidden" name="subject" value={props.subject} />
      <input type="hidden" name="from_address" value={props.fromAddress} />
      <input type="hidden" name="received_at" value={props.receivedAt} />
      <input type="hidden" name="body_preview" value={props.bodyPreview} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Tagging…" : "Tag to project"}
      </Button>
      {state.error && <p className="mt-1 max-w-[200px] text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
