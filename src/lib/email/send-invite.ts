import "server-only";

function renderInviteHtml(params: {
  companyName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}): string {
  return `<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 18px; margin: 0 0 16px;">You're invited to ${params.companyName}</h1>
    <p style="font-size: 14px; line-height: 1.5;">
      ${params.inviterName} invited you to join <strong>${params.companyName}</strong> on
      Tendorra as a <strong>${params.role}</strong>.
    </p>
    <p style="margin: 24px 0;">
      <a href="${params.inviteUrl}" style="background: #0f172a; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-size: 14px;">
        Accept invite
      </a>
    </p>
    <p style="font-size: 12px; color: #666; word-break: break-all;">${params.inviteUrl}</p>
  </body>
</html>`;
}

// Best-effort: a missing API key or a failed send never blocks invite
// creation — the caller always has the raw inviteUrl to share manually.
export async function sendInviteEmail(params: {
  to: string;
  companyName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.RESEND_FROM_EMAIL || "Tendorra <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: `${params.inviterName} invited you to join ${params.companyName} on Tendorra`,
        html: renderInviteHtml(params),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
