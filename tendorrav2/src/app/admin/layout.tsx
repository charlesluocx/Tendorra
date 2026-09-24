import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { SidebarNav } from "@/components/sidebar-nav";

export const metadata = { title: { default: "Admin", template: "%s · Tendorra Admin" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requirePlatformAdmin();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-slate-900 p-4 text-slate-100 md:flex">
        <Link href="/admin" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-bold text-slate-900">T</span>
          <span>Tendorra <span className="text-xs font-normal text-slate-400">Admin</span></span>
        </Link>
        <div className="admin-nav mt-6 flex-1">
          <SidebarNav
            items={[
              { href: "/admin", label: "Overview", icon: "📊", exact: true },
              { href: "/admin/organizations", label: "Companies", icon: "🏢" },
              { href: "/admin/users", label: "Users", icon: "👤" },
              { href: "/admin/activity", label: "Activity", icon: "📜" },
            ]}
          />
        </div>
        <Link href="/app" className="rounded-lg border border-slate-700 px-3 py-2 text-center text-sm hover:bg-slate-800">
          ← Back to app
        </Link>
        <div className="mt-3 truncate text-xs text-slate-400">{profile.email}</div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white md:hidden">
          <span className="font-semibold">Tendorra Admin</span>
          <nav className="flex gap-3 text-sm">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/organizations">Companies</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/activity">Activity</Link>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-8 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
