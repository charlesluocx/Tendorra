import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES } from "@/lib/timeline";

export { CATEGORIES, type Category } from "@/lib/timeline";

const ExtractionSchema = z.object({
  email_summary: z.string().describe("One or two sentence plain-English summary of the email."),
  items: z
    .array(
      z.object({
        title: z.string().describe("Short headline, max ~80 characters, e.g. 'DA lodged with council'."),
        summary: z.string().describe("One or two sentences with the key facts (who, what, amounts, references)."),
        occurred_at: z
          .string()
          .describe("ISO 8601 date or datetime when this happened or is scheduled to happen."),
        kind: z.enum(["event", "milestone"]),
        milestone_status: z
          .enum(["planned", "achieved", "missed"])
          .nullable()
          .describe("Required for milestones, null for events."),
        category: z.enum(CATEGORIES),
      }),
    )
    .describe("Timeline entries found in this email, oldest first. Usually 1-3."),
});

export type Extraction = z.infer<typeof ExtractionSchema>;

export type EmailForExtraction = {
  subject: string;
  fromName: string | null;
  fromAddress: string | null;
  to: string[];
  cc: string[];
  sentAt: string | null;
  bodyText: string;
  attachments: { name: string }[];
};

const SYSTEM_PROMPT = `You maintain the project history for a property development company. Staff forward you emails about a specific development project; you turn each email into timeline entries.

How to decide what goes on the timeline:
- An "event" is something that happened or was communicated: a submission, a response, a meeting, a request for information, a variation, a payment, a delay.
- A "milestone" is a major project gate that a project manager would report to the board or investors. Typical examples: land settlement, DA/planning approval lodged or granted, construction certificate issued, finance approved, head contract executed, tender awarded, construction start, slab/structure/lockup/practical completion, occupation certificate, sales launch, settlement of units, project handover.
- Use milestone_status "achieved" when the email confirms it happened, "planned" when it announces a future date or target, "missed" when the email says a milestone date was not met or has slipped.
- occurred_at is when the thing happened or is scheduled, not when the email was sent — but fall back to the email's sent date when no other date is given. Resolve relative dates ("next Tuesday") against the sent date.
- Ignore signatures, disclaimers, quoted earlier replies that repeat known history, and pleasantries.
- If the email has nothing worth recording, still return one event summarising the correspondence with category "correspondence".
- Never invent facts, names, amounts or dates that are not in the email.`;

function buildUserPrompt(email: EmailForExtraction, projectName: string, knownMilestones: string[]) {
  return [
    `Project: ${projectName}`,
    knownMilestones.length
      ? `Milestones already on this project's timeline (don't duplicate them; a status change is a new entry):\n${knownMilestones.map((m) => `- ${m}`).join("\n")}`
      : "No milestones recorded yet.",
    "",
    "<email>",
    `Subject: ${email.subject}`,
    `From: ${[email.fromName, email.fromAddress && `<${email.fromAddress}>`].filter(Boolean).join(" ")}`,
    `To: ${email.to.join(", ")}`,
    email.cc.length ? `Cc: ${email.cc.join(", ")}` : null,
    `Sent: ${email.sentAt ?? "unknown"}`,
    email.attachments.length ? `Attachments: ${email.attachments.map((a) => a.name).join(", ")}` : null,
    "",
    email.bodyText,
    "</email>",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Fallback when no API key is configured or the call fails: one event per email. */
export function heuristicExtraction(email: EmailForExtraction): Extraction {
  const text = `${email.subject}\n${email.bodyText}`.toLowerCase();
  const milestoneWords =
    /(approved|approval granted|settled|settlement|executed|awarded|practical completion|occupation certificate|construction certificate|commence(d|ment)|topped out|handover|signed)/;
  const isMilestone = milestoneWords.test(text);
  const firstParagraph = email.bodyText.split(/\n\s*\n/).find((p) => p.trim().length > 20) ?? "";
  return {
    email_summary: firstParagraph.slice(0, 280),
    items: [
      {
        title: email.subject.slice(0, 120),
        summary: firstParagraph.slice(0, 400),
        occurred_at: email.sentAt ?? new Date().toISOString(),
        kind: isMilestone ? "milestone" : "event",
        milestone_status: isMilestone ? "achieved" : null,
        category: "correspondence",
      },
    ],
  };
}

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractTimeline(
  email: EmailForExtraction,
  projectName: string,
  knownMilestones: string[],
): Promise<{ extraction: Extraction; usedAi: boolean; error?: string }> {
  if (!aiEnabled()) return { extraction: heuristicExtraction(email), usedAi: false };

  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      // If the primary model declines, the API re-runs the request on a fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: betaZodOutputFormat(ExtractionSchema) },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(email, projectName, knownMilestones) }],
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { extraction: heuristicExtraction(email), usedAi: false, error: "Claude could not read this email" };
    }
    return { extraction: response.parsed_output, usedAi: true };
  } catch (err) {
    const message =
      err instanceof Anthropic.RateLimitError
        ? "Claude is rate limited; used basic extraction"
        : err instanceof Anthropic.APIError
          ? `Claude API error ${err.status}; used basic extraction`
          : "Claude unavailable; used basic extraction";
    console.error("extractTimeline failed", err);
    return { extraction: heuristicExtraction(email), usedAi: false, error: message };
  }
}
