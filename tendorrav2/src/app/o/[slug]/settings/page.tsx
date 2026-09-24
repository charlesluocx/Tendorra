import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrg } from "@/lib/auth";
import { TOOLS } from "@/lib/tools/registry";
import { formatDate, formatDateTime } from "@/lib/format";
import { InviteForm, MemberRow, RenameForm, RevokeButton, ToolToggle } from "./settings-client";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { org, profile, isAdmin } = await requireOrg(slug);
  if (!isAdmin) notFound();
  const supabase = await createClient();

  const [{ data: members }, { data: invites }, { data: tools }, { data: activity }] = await Promise.all([
    supabase.from("memberships").select("user_id, role, created_at, profiles!inner(email, full_name)").eq("org_id", org.id).order("created_at"),
    supabase.from("invitations").select("id, email, role, expires_at, created_at").eq("org_id", org.id).is("accepted_at", null).order("created_at", { ascending: false }),
    supabase.from("org_tools").select("tool_key, enabled").eq("org_id", org.id),
    supabase.from("activity_log").select("id, action, meta, created_at, profiles(email, full_name)").eq("org_id", org.id).order("created_at", { ascending: false }).limit(25),
  ]);
  const enabled = new Map((tools ?? []).map((t) => [t.tool_key, t.enabled]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Settings</h1>

      <section className="card p-6">
        <h2 className="mb-4 font-semibold">Company</h2>
        <RenameForm slug={slug} name={org.name} />
        <p className="mt-3 text-xs text-slate-500">Workspace URL: /o/{org.slug} · Plan: <span className="capitalize">{org.plan}</span></p>
      </section>

      <section className="card overflow-hidden">
        <div className="p-6 pb-4">
          <h2 className="font-semibold">Staff</h2>
          <p className="text-sm text-slate-500">Everyone here can see all of {org.name}&apos;s projects. Admins can manage staff and tools.</p>
        </div>
        <table className="table">
          <thead><tr><th>Person</th><th>Role</th><th>Joined</th><th /></tr></thead>
          <tbody>
            {(members ?? []).map((m) => {
              const p = m.profiles as unknown as { email: string; full_name: string | null };
              return (
                <MemberRow
                  key={m.user_id}
                  slug={slug}
                  isSelf={m.user_id === profile.id}
                  member={{ user_id: m.user_id, role: m.role, name: p.full_name ?? p.email, email: p.email, joined: formatDate(m.created_at) }}
                />
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-slate-100 p-6">
          <h3 className="mb-3 text-sm font-semibold">Invite staff</h3>
          <InviteForm slug={slug} />
          {(invites ?? []).length > 0 && (
            <div className="mt-5">
              <h4 className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">Pending invitations</h4>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {(invites ?? []).map((i) => (
                  <li key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{i.email} <span className="text-xs text-slate-500">· {i.role} · expires {formatDate(i.expires_at)}</span></span>
                    <RevokeButton slug={slug} id={i.id} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="card p-6">
        <h2 className="font-semibold">Tools</h2>
        <p className="mb-4 text-sm text-slate-500">Choose which tools your staff see. New tools will appear here as they launch.</p>
        <ul className="divide-y divide-slate-100">
          {TOOLS.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-start gap-3">
                <span className="text-xl">{t.icon}</span>
                <div>
                  <div className="font-medium">
                    {t.name}
                    {t.status === "coming_soon" && <span className="badge ml-2 bg-slate-100 text-slate-500">Coming soon</span>}
                  </div>
                  <div className="text-sm text-slate-500">{t.description}</div>
                </div>
              </div>
              <ToolToggle slug={slug} toolKey={t.key} enabled={t.status === "live" && Boolean(enabled.get(t.key))} disabled={t.status !== "live"} />
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-6">
        <h2 className="mb-3 font-semibold">Recent activity</h2>
        <ul className="space-y-2 text-sm">
          {(activity ?? []).map((a) => {
            const who = a.profiles as unknown as { email: string; full_name: string | null } | null;
            const meta = a.meta as Record<string, unknown>;
            return (
              <li key={a.id} className="flex justify-between gap-4">
                <span>
                  <strong>{who?.full_name ?? who?.email ?? "Someone"}</strong>{" "}
                  <span className="text-slate-600">{a.action.replace(".", " ")}</span>{" "}
                  <span className="text-slate-500">{String(meta?.subject ?? meta?.name ?? meta?.title ?? meta?.email ?? "")}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(a.created_at)}</span>
              </li>
            );
          })}
          {(activity ?? []).length === 0 && <li className="text-slate-500">No activity yet.</li>}
        </ul>
      </section>
    </div>
  );
}
