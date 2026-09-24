import "server-only";

export type ParsedEmail = {
  summary: string;
  commitments: string[];
  key_dates: string[];
  usage: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
};

const SYSTEM_PROMPT = `You extract structured project-activity data from a construction/property project email for a busy project manager's activity feed. Read the email and respond with JSON only, no commentary, no markdown code fences, in exactly this shape:
{"summary": "one or two sentence plain-English summary of what happened or was asked", "commitments": ["short phrase per commitment or promise made by either party"], "key_dates": ["short phrase naming any date/deadline mentioned, e.g. 'Site visit Friday 14 March'"]}
If there are no commitments or dates, return empty arrays for them. Never invent facts not present in the email.`;

// Cloudflare Workers AI instead of a paid provider — a free daily allocation
// (no card required) comfortably covers this app's per-email parsing volume.
// Open-weight models are less reliable than Claude at "JSON only, no
// commentary", so the response is scanned for the first {...} block rather
// than parsed as-is.
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

export async function parseEmailWithAI(params: {
  subject: string | null;
  from: string | null;
  receivedAt: string | null;
  body: string;
}): Promise<ParsedEmail> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) throw new Error("CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_API_TOKEN is not configured.");

  const userContent = [
    params.subject ? `Subject: ${params.subject}` : "",
    params.from ? `From: ${params.from}` : "",
    params.receivedAt ? `Received: ${params.receivedAt}` : "",
    "",
    params.body.slice(0, 20_000),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Cloudflare Workers AI error [${res.status}]: ${await res.text()}`);
  }

  const data = await res.json();
  if (!data.success) {
    throw new Error(`Cloudflare Workers AI error: ${JSON.stringify(data.errors)}`);
  }

  const text: string = data.result?.response ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");

  const parsed = JSON.parse(match[0]) as Partial<ParsedEmail>;
  return {
    summary: parsed.summary?.trim() || "No summary available.",
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map(String) : [],
    key_dates: Array.isArray(parsed.key_dates) ? parsed.key_dates.map(String) : [],
    usage: {
      model: MODEL,
      inputTokens: Number(data.result?.usage?.prompt_tokens ?? 0),
      outputTokens: Number(data.result?.usage?.completion_tokens ?? 0),
    },
  };
}
