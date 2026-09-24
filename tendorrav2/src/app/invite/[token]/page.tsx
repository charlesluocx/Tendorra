import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { AcceptForm } from "./accept-form";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation", { p_token: token });
  const invite = (data as { org_name: string; email: string; role: string; expired: boolean; accepted: boolean }[] | null)?.[0];
  const profile = await getProfile();
  const here = `/invite/${token}`;

  let body: React.ReactNode;
  if (!invite) {
    body = <p className="text-slate-600">This invitation link is not valid.</p>;
  } else if (invite.accepted) {
    body = (
      <p className="text-slate-600">
        This invitation has already been used. <Link className="text-brand-600" href="/app">Go to Tendorra</Link>
      </p>
    );
  } else if (invite.expired) {
    body = <p className="text-slate-600">This invitation has expired. Ask your admin to send a new one.</p>;
  } else if (!profile) {
    body = (
      <div className="space-y-3">
        <p className="text-slate-600">
          Create an account or sign in with <strong>{invite.email}</strong> to join.
        </p>
        <div className="flex gap-2">
          <Link className="btn-primary flex-1" href={`/signup?next=${encodeURIComponent(here)}`}>Create account</Link>
          <Link className="btn-secondary flex-1" href={`/login?next=${encodeURIComponent(here)}`}>Sign in</Link>
        </div>
      </div>
    );
  } else if (profile.email.toLowerCase() !== invite.email.toLowerCase()) {
    body = (
      <div className="space-y-3 text-slate-600">
        <p>
          This invite is for <strong>{invite.email}</strong>, but you&apos;re signed in as <strong>{profile.email}</strong>.
        </p>
        <form action="/auth/signout" method="post">
          <button className="btn-secondary w-full">Sign out and switch account</button>
        </form>
      </div>
    );
  } else {
    body = <AcceptForm token={token} />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-white to-brand-50 px-4">
      <Logo />
      <div className="card mt-6 w-full max-w-md p-6">
        <h1 className="text-xl font-semibold">
          {invite ? <>Join {invite.org_name} on Tendorra</> : "Invitation"}
        </h1>
        {invite && <p className="mt-1 text-sm text-slate-500">You&apos;ve been invited as {invite.role}.</p>}
        <div className="mt-5">{body}</div>
      </div>
    </main>
  );
}
