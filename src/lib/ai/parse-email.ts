import "server-only";

export type ParsedEmail = {
  summary: string;
  commitments: string[];
  key_dates: string[];
};

const SYSTEM_PROMPT = `You extract structured project-activity data from a construction/property project email for a busy project manager's activity feed. Read the email and respond with JSON only, no commentary, in exactly this shape:
{"summary": "one or two sentence plain-English summary of what happened or was asked", "commitments": ["short phrase per commitment or promise made by either party"], "key_dates": ["short phrase naming any date/deadline mentioned, e.g. 'Site visit Friday 14 March'"]}
If there are no commitments or dates, return empty arrays for them. Never invent facts not present in the email.`;

export async function parseEmailWithAI(params: {
  subject: string | null;
  from: string | null;
  receivedAt: string | null;
  body: string;
}): Promise<ParsedEmail> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured.");

  const userContent = [
    params.subject ? `Subject: ${params.subject}` : "",
    params.from ? `From: ${params.from}` : "",
    params.receivedAt ? `Received: ${params.receivedAt}` : "",
    "",
    params.body.slice(0, 20_000),
  ]
    .filter(Boolean)
    .join("\n");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    throw new Error(`Anthropic API error [${res.status}]: ${await res.text()}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI response did not contain JSON.");

  const parsed = JSON.parse(match[0]) as Partial<ParsedEmail>;
  return {
    summary: parsed.summary?.trim() || "No summary available.",
    commitments: Array.isArray(parsed.commitments) ? parsed.commitments.map(String) : [],
    key_dates: Array.isArray(parsed.key_dates) ? parsed.key_dates.map(String) : [],
  };
}
