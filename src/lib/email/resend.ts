import "server-only";

// Best-effort: a missing API key or a failed send never throws — callers
// treat email as a nice-to-have on top of an in-app fallback (a copy-link
// UI, a dashboard flag), never a dependency for the feature to work.
export async function sendEmail(params: { to: string; subject: string; html: string }): Promise<boolean> {
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
      body: JSON.stringify({ from, ...params }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
