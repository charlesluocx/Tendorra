import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStaleReminderEmail } from "@/lib/email/send-stale-reminder";

// Cooldown between reminder emails for the same project, so a company with
// stale_after_days = 7 doesn't get emailed every time this job runs.
const REMINDER_COOLDOWN_HOURS = 24;

// Triggered on a schedule by .github/workflows/stale-reminders.yml (or any
// external scheduler) — Cloudflare Workers doesn't run this app's `scheduled`
// handler under the OpenNext adapter, so the cron lives outside the app and
// just calls this route. Protected by a shared secret since it acts across
// every company with the service-role client.
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const appUrl = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");

  const { data: staleStatuses, error: statusError } = await supabase
    .from("project_activity_status")
    .select("project_id, company_id, name, last_activity_at")
    .eq("is_stale", true);
  if (statusError) return NextResponse.json({ error: statusError.message }, { status: 500 });

  // The view's GROUP BY makes every column nullable in the generated types,
  // but project_id/company_id/name are never actually null — they come
  // straight from the underlying NOT NULL columns on projects/companies.
  const stale = (staleStatuses ?? []).filter(
    (s): s is typeof s & { project_id: string; company_id: string; name: string } =>
      s.project_id !== null && s.company_id !== null && s.name !== null,
  );
  if (stale.length === 0) {
    return NextResponse.json({ remindersSent: 0, projectsChecked: 0 });
  }

  const projectIds = stale.map((s) => s.project_id);
  const { data: projectRows, error: projectsError } = await supabase
    .from("projects")
    .select("id, last_reminder_sent_at")
    .in("id", projectIds);
  if (projectsError) return NextResponse.json({ error: projectsError.message }, { status: 500 });

  const cooldownCutoff = Date.now() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000;
  const lastReminderById = new Map((projectRows ?? []).map((p) => [p.id, p.last_reminder_sent_at]));
  const dueProjects = stale.filter((s) => {
    const last = lastReminderById.get(s.project_id);
    return !last || new Date(last).getTime() < cooldownCutoff;
  });
  if (dueProjects.length === 0) {
    return NextResponse.json({ remindersSent: 0, projectsChecked: stale.length });
  }

  const companyIds = [...new Set(dueProjects.map((p) => p.company_id))];
  const [{ data: companies }, { data: recipients }] = await Promise.all([
    supabase.from("companies").select("id, name").in("id", companyIds),
    supabase.from("company_users").select("company_id, user_id").in("company_id", companyIds).in("role", ["owner", "admin"]),
  ]);

  const recipientUserIds = [...new Set((recipients ?? []).map((r) => r.user_id))];
  const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", recipientUserIds);
  const emailByUserId = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const companyNameById = new Map((companies ?? []).map((c) => [c.id, c.name]));

  let remindersSent = 0;
  for (const companyId of companyIds) {
    const companyName = companyNameById.get(companyId) ?? "your company";
    const companyProjects = dueProjects
      .filter((p) => p.company_id === companyId)
      .map((p) => ({
        name: p.name,
        lastActivityAt: p.last_activity_at,
        projectUrl: `${appUrl}/projects/${p.project_id}`,
      }));

    const recipientEmails = (recipients ?? [])
      .filter((r) => r.company_id === companyId)
      .map((r) => emailByUserId.get(r.user_id))
      .filter((email): email is string => Boolean(email));

    for (const email of recipientEmails) {
      const sent = await sendStaleReminderEmail({ to: email, companyName, projects: companyProjects });
      if (sent) remindersSent += 1;
    }
  }

  await supabase
    .from("projects")
    .update({ last_reminder_sent_at: new Date().toISOString() })
    .in(
      "id",
      dueProjects.map((p) => p.project_id),
    );

  return NextResponse.json({ remindersSent, projectsChecked: stale.length, projectsDue: dueProjects.length });
}
