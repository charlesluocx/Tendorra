import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { Logo } from "@/components/logo";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect("/app");

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-brand-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />
        <div className="flex gap-2">
          <Link href="/login" className="btn-ghost">Sign in</Link>
          <Link href="/signup" className="btn-primary">Create account</Link>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-6 pt-20 pb-16 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
          Every development project, one clear timeline.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Drag emails straight out of Outlook or Gmail. Tendorra uses Claude to log what happened, flag the
          milestones that matter, and draw the project history for your whole team.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/signup" className="btn-primary px-5 py-2.5 text-base">Get started</Link>
          <Link href="/login" className="btn-secondary px-5 py-2.5 text-base">Sign in</Link>
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        {[
          ["📨", "Drop in emails", "Drag .msg files from Outlook desktop, or .eml files from Gmail and Outlook web."],
          ["🏁", "Milestones found for you", "Approvals, contracts, finance and completion flagged automatically."],
          ["🏢", "Private to your company", "Each company gets its own workspace. Staff sign in and see only their company's projects."],
        ].map(([icon, title, body]) => (
          <div key={title} className="card p-5">
            <div className="text-2xl">{icon}</div>
            <h3 className="mt-2 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-slate-600">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
