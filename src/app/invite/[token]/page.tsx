import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AcceptInviteForm } from "@/components/team/accept-invite-form";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("company_invites")
    .select("email, role, status, companies(name)")
    .eq("token", token)
    .maybeSingle();

  const company = invite?.companies as unknown as { name: string } | null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{company ? `Join ${company.name}` : "Invite"}</CardTitle>
          <CardDescription>
            {!invite || invite.status !== "pending"
              ? "This invite link is no longer valid."
              : `You've been invited as ${invite.role === "member" ? "a team member" : `an ${invite.role}`}. Set a password to join.`}
          </CardDescription>
        </CardHeader>
        {invite && invite.status === "pending" && (
          <CardContent>
            <AcceptInviteForm token={token} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
