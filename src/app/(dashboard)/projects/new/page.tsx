"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createProject, type CreateProjectState } from "./actions";

const initialState: CreateProjectState = { error: null };

export default function NewProjectPage() {
  const [state, action, pending] = useActionState(createProject, initialState);

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">New Project</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Add the basics — you can start logging activity right away.
      </p>

      <form action={action} className="mt-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">Project Name</Label>
          <Input id="name" name="name" required placeholder="e.g. 42 Smith Street Apartments" />
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div className="space-y-2">
            <Label htmlFor="address">Site Address</Label>
            <Input id="address" name="address" required placeholder="e.g. 42 Smith Street, Collingwood VIC" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input id="postcode" name="postcode" inputMode="numeric" placeholder="3066" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="project_type">Project Type (optional)</Label>
          <Input id="project_type" name="project_type" placeholder="e.g. Townhouse development" />
        </div>

        {state.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating…" : "Create Project"}
          </Button>
        </div>
      </form>
    </div>
  );
}
