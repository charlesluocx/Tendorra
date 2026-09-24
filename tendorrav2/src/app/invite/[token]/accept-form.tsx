"use client";

import { useActionState } from "react";
import { acceptInvite } from "./actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function AcceptForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvite, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Joining…">Accept invitation</SubmitButton>
    </form>
  );
}
