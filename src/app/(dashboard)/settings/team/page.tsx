import { createClient } from "@/lib/supabase/server";
import { getCurrentMembership } from "@/lib/company";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InviteForm } from "@/components/team/invite-form";
import { RoleSelect } from "@/components/team/role-select";
import { revokeInvite } from "./actions";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const membership = await getCurrentMembership(supabase, user.id);
  const canManage = membership !== null && ["owner", "admin"].includes(membership.role);

  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase
      .from("company_users")
      .select("id, user_id, role, created_at, profiles(email, full_name)")
      .order("created_at", { ascending: true }),
    canManage
      ? supabase
          .from("company_invites")
          .select("id, email, role, status, created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as never[] }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Team</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Everyone with access to your company&apos;s projects.
      </p>

      {canManage && (
        <div className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Invite someone
          </h2>
          <div className="mt-3">
            <InviteForm />
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Members</h2>
        <ul className="mt-3 divide-y divide-border rounded-md border border-border">
          {(members ?? []).map((member) => {
            const profile = member.profiles as unknown as { email: string | null; full_name: string | null } | null;
            return (
              <li key={member.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate text-foreground">{profile?.full_name || profile?.email || "Unknown"}</p>
                  {profile?.full_name && (
                    <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
                  )}
                </div>
                {canManage ? (
                  <RoleSelect memberId={member.id} role={member.role} disabled={member.user_id === user.id} />
                ) : (
                  <Badge variant="outline" className="capitalize">
                    {member.role}
                  </Badge>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {canManage && (invites ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pending invites
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-md border border-border">
            {(invites ?? []).map((invite) => (
              <li key={invite.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div>
                  <p className="text-foreground">{invite.email}</p>
                  <p className="text-xs capitalize text-muted-foreground">{invite.role}</p>
                </div>
                <form action={revokeInvite}>
                  <input type="hidden" name="id" value={invite.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
