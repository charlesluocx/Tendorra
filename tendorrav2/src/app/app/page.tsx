import { redirect } from "next/navigation";
import { getMyOrgs, requireProfile } from "@/lib/auth";

// Entry point after sign-in: go to the user's first workspace, or create one.
export default async function AppIndex() {
  const profile = await requireProfile();
  const orgs = await getMyOrgs();
  const active = orgs.find((o) => o.org.status === "active") ?? orgs[0];
  if (active) redirect(`/o/${active.org.slug}`);
  if (profile.is_platform_admin) redirect("/onboarding?admin=1");
  redirect("/onboarding");
}
