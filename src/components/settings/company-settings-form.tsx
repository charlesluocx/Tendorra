"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateCompanySettings, type CompanySettingsState } from "@/app/(dashboard)/settings/company/actions";

const initialState: CompanySettingsState = { error: null };

export function CompanySettingsForm(props: { name: string; website: string; staleAfterDays: number }) {
  const [state, action, pending] = useActionState(updateCompanySettings, initialState);

  return (
    <form action={action} className="mt-6 space-y-5">
      <input type="hidden" name="current_website" value={props.website} />

      <div className="space-y-1.5">
        <Label htmlFor="name">Company name</Label>
        <Input id="name" name="name" defaultValue={props.name} required />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="website">Company website</Label>
        <Input id="website" name="website" placeholder="acme.com" defaultValue={props.website} />
        <p className="text-xs text-muted-foreground">
          Changing this re-fetches your logo and brand color, same as at signup.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="stale_after_days">Flag a project as &quot;gone quiet&quot; after</Label>
        <div className="flex items-center gap-2">
          <Input
            id="stale_after_days"
            name="stale_after_days"
            type="number"
            min={1}
            step={1}
            defaultValue={props.staleAfterDays}
            required
            className="w-24"
          />
          <span className="text-sm text-muted-foreground">days without any activity logged</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {state.success && <p className="text-sm text-muted-foreground">Saved.</p>}
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
    </form>
  );
}
