import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { CompanySettingsForm } from "@/components/settings/company-settings-form";

export default async function CompanySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getCurrentMembership(supabase, user.id);
  const canManage = membership !== null && ["owner", "admin"].includes(membership.role);

  const { data: company } = membership
    ? await supabase
        .from("companies")
        .select("name, website, stale_after_days")
        .eq("id", membership.companyId)
        .single()
    : { data: null };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Company</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        General settings for your whole company.
      </p>

      {!canManage ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Only owners and admins can change these settings.
        </p>
      ) : (
        <CompanySettingsForm
          name={company?.name ?? ""}
          website={company?.website ?? ""}
          staleAfterDays={company?.stale_after_days ?? 7}
        />
      )}
    </div>
  );
}
