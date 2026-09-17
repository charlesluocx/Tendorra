import { createServerFn } from "@tanstack/react-start";

export type QuoteDetails = {
  status: string;
  projectName: string;
  projectAddress: string;
  categoryName: string;
  consultantName: string;
  feeAmount: number | null;
  paymentTerms: string | null;
  startAvailability: string | null;
  turnaround: string | null;
  submittedAt: string | null;
};

export const getQuoteByToken = createServerFn({ method: "GET" })
  .inputValidator((token: string) => String(token ?? "").trim())
  .handler(async ({ data: token }): Promise<QuoteDetails | null> => {
    if (!token) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quote, error } = await supabaseAdmin
      .from("quotes")
      .select(
        "status, fee_amount, payment_terms, start_availability, turnaround, submitted_at, projects(name, address), consultant_categories(name), consultants(name)",
      )
      .eq("invite_token", token)
      .maybeSingle();

    if (error || !quote) return null;

    const project = quote.projects as unknown as { name: string; address: string } | null;
    const category = quote.consultant_categories as unknown as { name: string } | null;
    const consultant = quote.consultants as unknown as { name: string } | null;
    if (!project || !category) return null;

    return {
      status: quote.status,
      projectName: project.name,
      projectAddress: project.address,
      categoryName: category.name,
      consultantName: consultant?.name ?? "",
      feeAmount: quote.fee_amount,
      paymentTerms: quote.payment_terms,
      startAvailability: quote.start_availability,
      turnaround: quote.turnaround,
      submittedAt: quote.submitted_at,
    };
  });

type SubmitInput = {
  token: string;
  feeAmount: number;
  paymentTerms: string;
  startAvailability: string;
  turnaround: string;
};

export const submitQuote = createServerFn({ method: "POST" })
  .inputValidator((input: SubmitInput) => {
    const fee = Number(input.feeAmount);
    if (!Number.isFinite(fee) || fee <= 0) throw new Error("Enter a valid fee amount");
    return {
      token: String(input.token ?? "").trim(),
      feeAmount: fee,
      paymentTerms: String(input.paymentTerms ?? "").trim(),
      startAvailability: String(input.startAvailability ?? "").trim(),
      turnaround: String(input.turnaround ?? "").trim(),
    };
  })
  .handler(async ({ data }): Promise<{ ok: true }> => {
    if (!data.token) throw new Error("Invalid link");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: quote, error: lookupError } = await supabaseAdmin
      .from("quotes")
      .select("id, status")
      .eq("invite_token", data.token)
      .maybeSingle();
    if (lookupError || !quote) throw new Error("Invalid link");
    if (quote.status === "submitted") throw new Error("This quote has already been submitted");

    const { error: updateError } = await supabaseAdmin
      .from("quotes")
      .update({
        fee_amount: data.feeAmount,
        payment_terms: data.paymentTerms || null,
        start_availability: data.startAvailability || null,
        turnaround: data.turnaround || null,
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", quote.id);
    if (updateError) throw new Error("Could not submit your quote — please try again");

    return { ok: true };
  });
