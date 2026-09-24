"use client";

import { useActionState } from "react";
import { FormMessage, type FormState } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

export type ProjectValues = {
  name?: string;
  code?: string | null;
  address?: string | null;
  description?: string | null;
  status?: string;
  start_date?: string | null;
  target_end_date?: string | null;
};

export function ProjectForm({
  action,
  initial = {},
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ProjectValues;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className="label" htmlFor="name">Project name</label>
        <input className="input" id="name" name="name" defaultValue={initial.name} required placeholder="e.g. 12 Harbour St — Mixed Use" />
      </div>
      <div>
        <label className="label" htmlFor="code">Project code</label>
        <input className="input" id="code" name="code" defaultValue={initial.code ?? ""} placeholder="HS-012" />
      </div>
      <div>
        <label className="label" htmlFor="status">Status</label>
        <select className="input" id="status" name="status" defaultValue={initial.status ?? "active"}>
          <option value="planning">Planning</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="address">Site address</label>
        <input className="input" id="address" name="address" defaultValue={initial.address ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="start_date">Start date</label>
        <input className="input" type="date" id="start_date" name="start_date" defaultValue={initial.start_date ?? ""} />
      </div>
      <div>
        <label className="label" htmlFor="target_end_date">Target completion</label>
        <input className="input" type="date" id="target_end_date" name="target_end_date" defaultValue={initial.target_end_date ?? ""} />
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="description">Description</label>
        <textarea className="input" rows={3} id="description" name="description" defaultValue={initial.description ?? ""} />
      </div>
      <div className="flex items-center gap-3 sm:col-span-2">
        <SubmitButton>{submitLabel}</SubmitButton>
        <FormMessage state={state} />
      </div>
    </form>
  );
}
