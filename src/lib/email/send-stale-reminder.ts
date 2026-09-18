import "server-only";
import { sendEmail } from "./resend";

export type StaleProject = { name: string; lastActivityAt: string | null; projectUrl: string };

function daysSince(iso: string | null): string {
  if (!iso) return "no activity logged yet";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function renderReminderHtml(params: { companyName: string; projects: StaleProject[] }): string {
  const rows = params.projects
    .map(
      (p) => `
    <li style="margin-bottom: 8px;">
      <a href="${p.projectUrl}" style="color: #0f172a; font-weight: 600;">${p.name}</a>
      <span style="color: #666;"> — last activity ${daysSince(p.lastActivityAt)}</span>
    </li>`,
    )
    .join("");

  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">${params.projects.length} project${params.projects.length === 1 ? " has" : "s have"} gone quiet</h1>
    <p style="font-size: 14px; line-height: 1.5;">
      These ${params.companyName} projects haven't had any activity logged in a while:
    </p>
    <ul style="font-size: 14px; padding-left: 20px;">${rows}</ul>
  </body>
</html>`;
}

// Best-effort, same as sendInviteEmail: a missing key or a failed send is
// silent — the "Gone quiet" badge in the dashboard is the source of truth,
// this is just a proactive nudge on top of it.
export async function sendStaleReminderEmail(params: {
  to: string;
  companyName: string;
  projects: StaleProject[];
}): Promise<boolean> {
  if (params.projects.length === 0) return false;

  return sendEmail({
    to: params.to,
    subject: `${params.projects.length} ${params.companyName} project${params.projects.length === 1 ? "" : "s"} gone quiet`,
    html: renderReminderHtml(params),
  });
}
