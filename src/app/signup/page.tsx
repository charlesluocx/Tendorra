"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { createCompanyAndOwner, type SignupState } from "./actions";

const initialState: SignupState = { error: null };

export default function SignupPage() {
  const [state, action, pending] = useActionState(createCompanyAndOwner, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create your company</CardTitle>
          <CardDescription>
            You&apos;ll be the owner — you can invite your team once you&apos;re in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Your name</Label>
              <Input id="full_name" name="full_name" required autoComplete="name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Company name</Label>
              <Input id="company_name" name="company_name" required autoComplete="organization" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Company website (optional)</Label>
              <Input id="website" name="website" placeholder="acme.com" autoComplete="url" />
              <p className="text-xs text-muted-foreground">
                We&apos;ll pull your logo and brand color from this to theme your dashboard.
              </p>
            </div>
            {state.error && (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={pending}>
              {pending ? "Setting up your company…" : "Create company"}
            </Button>
          </form>
          <Link
            href="/login"
            className="mt-4 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
