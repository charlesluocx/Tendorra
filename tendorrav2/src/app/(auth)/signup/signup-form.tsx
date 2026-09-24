"use client";

import { useActionState } from "react";
import { signUp } from "../actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signUp, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="full_name">Full name</label>
        <input className="input" id="full_name" name="full_name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Work email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
