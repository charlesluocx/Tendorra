import Link from "next/link";

export const metadata = { title: "Workspace suspended" };

export default async function SuspendedPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  return (
    <main className="mx-auto max-w-lg px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Workspace suspended</h1>
      <p className="mt-3 text-slate-600">
        {org ? <strong>{org}</strong> : "This workspace"} has been suspended. Contact Tendorra support to restore access.
      </p>
      <Link href="/app" className="btn-secondary mt-6">Back</Link>
    </main>
  );
}
