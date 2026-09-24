export const metadata = { title: "Setup required" };

export default function SetupPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <div className="card p-8">
        <h1 className="text-2xl font-bold">Tendorra needs a database connection</h1>
        <p className="mt-3 text-slate-600">
          Set these environment variables (in Vercel → Project → Settings → Environment Variables, or in{" "}
          <code>.env.local</code> for local development), then redeploy:
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg bg-slate-900 p-4 text-sm text-slate-100">
{`NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=`}
        </pre>
        <p className="mt-4 text-sm text-slate-500">See README.md for the full setup guide.</p>
      </div>
    </main>
  );
}
