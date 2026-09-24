import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { CreateOrgForm } from "./create-org-form";

export const metadata = { title: "Set up your workspace" };

export default async function OnboardingPage() {
  const profile = await requireProfile();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-brand-50 px-4">
      <Logo href="/app" />
      <div className="card mt-6 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">Set up your company workspace</h1>
        <p className="mt-1 text-sm text-slate-500">
          Your workspace is private to your company. You&apos;ll be its owner and can invite staff from Settings.
        </p>
        <div className="mt-5">
          <CreateOrgForm />
        </div>
        <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
          Joining an existing company? Ask an admin there to invite <strong>{profile.email}</strong> and open the link
          they send you.
        </div>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        {profile.is_platform_admin && (
          <Link href="/admin" className="font-medium text-brand-600">Open admin console →</Link>
        )}
        <form action="/auth/signout" method="post">
          <button className="text-slate-500 hover:text-slate-700">Sign out</button>
        </form>
      </div>
    </main>
  );
}
