"use client";

import { useActionState, useState } from "react";
import { createOrganization } from "./actions";
import { FormMessage } from "@/components/form-message";
import { SubmitButton } from "@/components/submit-button";

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
}

export function CreateOrgForm() {
  const [state, action] = useActionState(createOrganization, undefined);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Company name</label>
        <input
          className="input"
          id="name"
          name="name"
          required
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(toSlug(e.target.value));
          }}
          placeholder="Acme Developments"
        />
      </div>
      <div>
        <label className="label" htmlFor="slug">Workspace URL</label>
        <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 text-sm shadow-sm focus-within:border-brand-500">
          <span className="pl-3 text-slate-500">tendorra/o/</span>
          <input
            className="w-full rounded-r-lg bg-white px-2 py-2 focus:outline-none"
            id="slug"
            name="slug"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(toSlug(e.target.value));
            }}
          />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Creating workspace…">Create workspace</SubmitButton>
    </form>
  );
}
