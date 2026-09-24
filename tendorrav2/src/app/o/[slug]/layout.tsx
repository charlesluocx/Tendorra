import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getMyOrgs, requireOrg } from "@/lib/auth";
import { TOOLS } from "@/lib/tools/registry";
import { Logo } from "@/components/logo";
import { SidebarNav, type NavItem } from "@/components/sidebar-nav";
import { OrgSwitcher } from "@/components/org-switcher";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { org, profile, isAdmin } = await requireOrg(slug);
  const orgs = await getMyOrgs();
  const supabase = await createClient();
  const { data: enabled } = await supabase.from("org_tools").select("tool_key").eq("org_id", org.id).eq("enabled", true);
  const enabledKeys = new Set((enabled ?? []).map((t) => t.tool_key));

  const base = `/o/${org.slug}`;
  const nav: NavItem[] = [
    { href: base, label: "Home", icon: "🏠", exact: true },
    ...TOOLS.filter((t) => t.status === "live" && enabledKeys.has(t.key)).map((t) => ({
      href: `${base}/${t.key}`,
      label: t.name,
      icon: t.icon,
    })),
    ...(isAdmin ? [{ href: `${base}/settings`, label: "Settings", icon: "⚙️" }] : []),
  ];

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <Logo href="/app" />
        <div className="mt-5">
          <OrgSwitcher current={org.slug} orgs={orgs.map((o) => ({ slug: o.org.slug, name: o.org.name }))} />
        </div>
        <div className="mt-4 flex-1">
          <SidebarNav items={nav} />
        </div>
        {profile.is_platform_admin && (
          <Link href="/admin" className="mb-3 rounded-lg bg-slate-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-slate-800">
            Admin console
          </Link>
        )}
        <div className="border-t border-slate-100 pt-3">
          <div className="truncate text-sm font-medium">{profile.full_name ?? profile.email}</div>
          <div className="truncate text-xs text-slate-500">{profile.email}</div>
          <form action="/auth/signout" method="post" className="mt-2">
            <button className="text-xs text-slate-500 hover:text-slate-800">Sign out</button>
          </form>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <Logo href="/app" />
          <div className="flex gap-3 text-sm">
            {nav.map((n) => (
              <Link key={n.href} href={n.href} title={n.label}>{n.icon}</Link>
            ))}
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
