import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { extractTimeline } from "@/lib/ai/extract";

export const maxDuration = 120;

const EmailPayload = z.object({
  projectId: z.string().uuid(),
  storagePath: z.string().nullable(),
  email: z.object({
    subject: z.string().max(1000),
    fromName: z.string().max(500).nullable(),
    fromAddress: z.string().max(500).nullable(),
    to: z.array(z.string().max(500)).max(500),
    cc: z.array(z.string().max(500)).max(500),
    sentAt: z.string().nullable(),
    bodyText: z.string().max(70_000),
    messageId: z.string().max(1000).nullable(),
    fileName: z.string().max(500).nullable(),
    format: z.enum(["eml", "msg", "text"]),
    attachments: z.array(z.object({ name: z.string(), size: z.number().nullable() })).max(200),
  }),
});

function normalizeDate(value: string, fallback: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const parsed = EmailPayload.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid email payload" }, { status: 400 });
  const { projectId, storagePath, email } = parsed.data;

  // RLS guarantees the caller can only see projects in their organizations.
  const { data: project } = await supabase.from("projects").select("id, org_id, name").eq("id", projectId).single();
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  if (storagePath && !storagePath.startsWith(`${project.org_id}/${project.id}/`)) {
    return NextResponse.json({ error: "Invalid storage path" }, { status: 400 });
  }

  if (email.messageId) {
    const { data: dupe } = await supabase
      .from("emails")
      .select("id")
      .eq("project_id", project.id)
      .eq("message_id", email.messageId)
      .maybeSingle();
    if (dupe) return NextResponse.json({ duplicate: true, subject: email.subject, items: [] });
  }

  const { data: known } = await supabase
    .from("timeline_items")
    .select("title, milestone_status")
    .eq("project_id", project.id)
    .eq("kind", "milestone")
    .order("occurred_at");

  const { extraction, usedAi, error: aiError } = await extractTimeline(
    email,
    project.name,
    (known ?? []).map((m) => `${m.title} (${m.milestone_status})`),
  );

  const sentAt = email.sentAt ?? new Date().toISOString();

  const { data: emailRow, error: emailErr } = await supabase
    .from("emails")
    .insert({
      org_id: project.org_id,
      project_id: project.id,
      subject: email.subject,
      from_name: email.fromName,
      from_address: email.fromAddress,
      to_addresses: email.to,
      cc_addresses: email.cc,
      sent_at: email.sentAt,
      body_text: email.bodyText,
      message_id: email.messageId,
      file_name: email.fileName,
      source_format: email.format,
      attachments: email.attachments,
      storage_path: storagePath,
      ai_summary: extraction.email_summary || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (emailErr || !emailRow) {
    return NextResponse.json({ error: emailErr?.message ?? "Could not save email" }, { status: 500 });
  }

  const rows = extraction.items.map((item) => ({
    org_id: project.org_id,
    project_id: project.id,
    email_id: emailRow.id,
    kind: item.kind,
    milestone_status: item.kind === "milestone" ? (item.milestone_status ?? "achieved") : null,
    title: item.title.slice(0, 300) || email.subject.slice(0, 300),
    summary: item.summary,
    category: item.category,
    occurred_at: normalizeDate(item.occurred_at, sentAt),
    ai_generated: usedAi,
    created_by: user.id,
  }));

  const { data: items, error: itemsErr } = rows.length
    ? await supabase.from("timeline_items").insert(rows).select("id, kind, title")
    : { data: [], error: null };
  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });

  await supabase.from("activity_log").insert({
    org_id: project.org_id,
    user_id: user.id,
    action: "email.ingested",
    entity_type: "email",
    entity_id: emailRow.id,
    meta: { project_id: project.id, subject: email.subject, items: rows.length, ai: usedAi },
  });

  return NextResponse.json({ duplicate: false, subject: email.subject, items, usedAi, warning: aiError });
}
