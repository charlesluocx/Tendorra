import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type InviteResult = {
  quoteId: string;
  inviteUrl: string;
  emailSent: boolean;
  emailError?: string | undefined;
};

type InviteInput = {
  projectId: string;
  categoryId: string;
  name: string;
  email: string;
  origin: string;
};

function makeToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sendInviteEmail(args: {
  to: string;
  consultantName: string;
  projectName: string;
  projectAddress: string;
  categoryName: string;
  inviteUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const resendKey = process.env["RESEND_API_KEY"];
  if (!resendKey || !lovableKey) {
    return {
      sent: false,
      error:
        "Email sending isn't configured yet — share the invite link below with the consultant.",
    };
  }

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
      <p>Hi ${args.consultantName},</p>
      <p>You've been invited to quote as <strong>${args.categoryName}</strong> on the following project:</p>
      <p><strong>${args.projectName}</strong><br/>${args.projectAddress}</p>
      <p>All consultants quote through the same structured form, so no account is needed.</p>
      <p><a href="${args.inviteUrl}" style="display:inline-block;background:#111;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">Submit your quote</a></p>
      <p style="font-size:12px;color:#555">Or paste this link into your browser: ${args.inviteUrl}</p>
    </div>
  `;

  try {
    const response = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": resendKey,
      },
      body: JSON.stringify({
        from: "TenderX <onboarding@resend.dev>",
        to: [args.to],
        subject: `Quote request: ${args.categoryName} — ${args.projectName}`,
        html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Resend request failed [${response.status}]: ${body}`);
      return { sent: false, error: `Email failed [${response.status}]: ${body}` };
    }
    return { sent: true };
  } catch (error) {
    console.error("Resend request threw", error);
    return { sent: false, error: String(error) };
  }
}

export const MAX_CONSULTANTS_PER_CATEGORY = 4;

export type RecommendedConsultant = {
  id: string;
  name: string;
  email: string;
  samePostcode: boolean;
};

export const listRecommendedConsultants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; categoryId: string }) => ({
    projectId: String(input.projectId),
    categoryId: String(input.categoryId),
  }))
  .handler(async ({ data, context }): Promise<RecommendedConsultant[]> => {
    const { supabase } = context;

    const { data: project } = await supabase
      .from("projects")
      .select("id, postcode")
      .eq("id", data.projectId)
      .maybeSingle();
    if (!project) throw new Error("Project not found");

    const { data: existingQuotes } = await supabase
      .from("quotes")
      .select("consultant_id")
      .eq("project_id", data.projectId)
      .eq("category_id", data.categoryId);
    const invited = new Set((existingQuotes ?? []).map((q) => q.consultant_id));

    const { data: consultants } = await supabase
      .from("consultants")
      .select("id, name, email, service_postcode")
      .eq("category_id", data.categoryId)
      .order("name", { ascending: true });

    const postcode = (project.postcode ?? "").trim();
    return (consultants ?? [])
      .filter((c) => !invited.has(c.id))
      .map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        samePostcode:
          postcode.length > 0 && (c.service_postcode ?? "").trim() === postcode,
      }))
      .sort((a, b) => Number(b.samePostcode) - Number(a.samePostcode));
  });

export const inviteExistingConsultant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { projectId: string; categoryId: string; consultantId: string; origin: string }) => ({
    projectId: String(input.projectId),
    categoryId: String(input.categoryId),
    consultantId: String(input.consultantId),
    origin: String(input.origin ?? ""),
  }))
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { supabase } = context;

    const { data: consultant } = await supabase
      .from("consultants")
      .select("id, name, email")
      .eq("id", data.consultantId)
      .maybeSingle();
    if (!consultant) throw new Error("Consultant not found");

    return createInvite({
      supabase,
      projectId: data.projectId,
      categoryId: data.categoryId,
      consultantId: consultant.id,
      consultantName: consultant.name,
      consultantEmail: consultant.email,
      origin: data.origin,
    });
  });

async function createInvite(args: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any;
  projectId: string;
  categoryId: string;
  consultantId: string;
  consultantName: string;
  consultantEmail: string;
  origin: string;
}): Promise<InviteResult> {
  const { supabase } = args;

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, name, address")
    .eq("id", args.projectId)
    .single();
  if (projectError || !project) throw new Error("Project not found");

  const { data: category, error: categoryError } = await supabase
    .from("consultant_categories")
    .select("id, name")
    .eq("id", args.categoryId)
    .single();
  if (categoryError || !category) throw new Error("Category not found");

  const { count } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .eq("project_id", args.projectId)
    .eq("category_id", args.categoryId);
  if ((count ?? 0) >= MAX_CONSULTANTS_PER_CATEGORY) {
    throw new Error("Maximum of 4 consultants reached for this category.");
  }

  const inviteToken = makeToken();
  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      project_id: args.projectId,
      consultant_id: args.consultantId,
      category_id: args.categoryId,
      invite_token: inviteToken,
      status: "pending",
    })
    .select("id")
    .single();
  if (quoteError || !quote) {
    throw new Error(quoteError?.message ?? "Could not create the quote request");
  }

  const inviteUrl = `${args.origin.replace(/\/$/, "")}/quote/${inviteToken}`;
  const emailResult = await sendInviteEmail({
    to: args.consultantEmail,
    consultantName: args.consultantName,
    projectName: project.name,
    projectAddress: project.address,
    categoryName: category.name,
    inviteUrl,
  });

  return {
    quoteId: quote.id,
    inviteUrl,
    emailSent: emailResult.sent,
    emailError: emailResult.error,
  };
}

export const inviteConsultant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: InviteInput) => {
    const name = String(input.name ?? "").trim();
    const email = String(input.email ?? "").trim().toLowerCase();
    if (!name) throw new Error("Consultant name is required");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("A valid email is required");
    return {
      projectId: String(input.projectId),
      categoryId: String(input.categoryId),
      name,
      email,
      origin: String(input.origin ?? ""),
    };
  })
  .handler(async ({ data, context }): Promise<InviteResult> => {
    const { supabase } = context;

    const { data: existing } = await supabase
      .from("consultants")
      .select("id")
      .eq("email", data.email)
      .eq("category_id", data.categoryId)
      .maybeSingle();

    let consultantId = existing?.id ?? null;
    if (!consultantId) {
      const { data: created, error: consultantError } = await supabase
        .from("consultants")
        .insert({ name: data.name, email: data.email, category_id: data.categoryId })
        .select("id")
        .single();
      if (consultantError || !created) {
        throw new Error(consultantError?.message ?? "Could not save the consultant");
      }
      consultantId = created.id;
    }

    return createInvite({
      supabase,
      projectId: data.projectId,
      categoryId: data.categoryId,
      consultantId,
      consultantName: data.name,
      consultantEmail: data.email,
      origin: data.origin,
    });
  });
