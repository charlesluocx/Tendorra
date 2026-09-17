import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { getQuoteByToken, submitQuote } from "@/lib/quote.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/quote/$token")({
  head: () => ({
    meta: [
      { title: "Submit a Quote — TenderX" },
      {
        name: "description",
        content:
          "Submit your consultant quote for an Australian property development project through TenderX's structured quote form.",
      },
      { property: "og:title", content: "Submit a Quote — TenderX" },
      {
        property: "og:description",
        content:
          "Submit your consultant quote for an Australian property development project through TenderX's structured quote form.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: QuotePage,
});

function QuotePage() {
  const { token } = useParams({ from: "/quote/$token" });
  const { data: quote, isLoading } = useQuery({
    queryKey: ["quote", token],
    queryFn: () => getQuoteByToken({ data: token }),
  });

  const [feeAmount, setFeeAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [startAvailability, setStartAvailability] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            This link is no longer valid.
          </h1>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
            Quote submitted
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Thanks — the project owner has been notified.
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await submitQuote({
        data: {
          token,
          feeAmount: Number(feeAmount),
          paymentTerms,
          startAvailability,
          turnaround,
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong — please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-xl">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quote request — {quote.categoryName}
            </p>
            <h1 className="mt-2 text-xl font-semibold tracking-tight text-foreground">
              {quote.projectName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{quote.projectAddress}</p>
          </CardContent>
        </Card>

        {quote.status === "submitted" ? (
          <div className="mt-8">
            <p className="rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
              You've already submitted a quote for this project.
            </p>
            <dl className="mt-6 space-y-5">
              <ReadOnlyField
                label="Fee Amount (AUD)"
                value={
                  quote.feeAmount != null
                    ? `$${Number(quote.feeAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
                    : "—"
                }
              />
              <ReadOnlyField label="Payment Terms" value={quote.paymentTerms || "—"} />
              <ReadOnlyField label="Start Availability" value={quote.startAvailability || "—"} />
              <ReadOnlyField label="Turnaround" value={quote.turnaround || "—"} />
            </dl>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="fee">Fee Amount (AUD)</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  id="fee"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="terms">Payment Terms</Label>
              <Input
                id="terms"
                type="text"
                placeholder="e.g. 30% deposit, balance on completion"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="availability">Start Availability</Label>
              <Input
                id="availability"
                type="date"
                value={startAvailability}
                onChange={(e) => setStartAvailability(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">When could you begin?</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="turnaround">Turnaround</Label>
              <Input
                id="turnaround"
                type="text"
                placeholder="e.g. 3 weeks from start"
                value={turnaround}
                onChange={(e) => setTurnaround(e.target.value)}
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Quote"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-foreground">{value}</dd>
    </div>
  );
}
