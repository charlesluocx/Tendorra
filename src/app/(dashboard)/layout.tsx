import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { readableForegroundFor } from "@/lib/branding/color";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("company_users")
    .select("companies(name, logo_url, brand_primary, brand_secondary)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  const company = membership?.companies as unknown as {
    name: string;
    logo_url: string | null;
    brand_primary: string | null;
    brand_secondary: string | null;
  } | null;

  const brandStyle = company?.brand_primary
    ? ({
        "--primary": company.brand_primary,
        "--primary-foreground": readableForegroundFor(company.brand_primary),
        "--ring": company.brand_primary,
        "--sidebar-primary": company.brand_primary,
        "--sidebar-primary-foreground": readableForegroundFor(company.brand_primary),
        "--sidebar-ring": company.brand_primary,
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="min-h-screen bg-background" style={brandStyle}>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/projects" className="flex items-center gap-2 text-lg font-semibold tracking-tight text-foreground">
            {company?.logo_url && (
              <Image
                src={company.logo_url}
                alt={company.name}
                width={24}
                height={24}
                unoptimized
                className="rounded-sm"
              />
            )}
            {company?.name ?? "Tendorra"}
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/settings/team" className="text-sm text-muted-foreground hover:text-foreground">
              Team
            </Link>
            <Link href="/settings/inbox" className="text-sm text-muted-foreground hover:text-foreground">
              Inbox settings
            </Link>
            <span className="hidden text-sm text-muted-foreground sm:inline">{user.email}</span>
            <form action={logout}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
