import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ScopeOfWork } from "@/components/ScopeOfWork";
import { CategorySuggestionStep } from "@/components/CategorySuggestionStep";
import { PHASES, suggestedNextPhase } from "@/lib/phases";
import { deleteProject, removeConsultantInvite } from "@/lib/projects.functions";
import {
  inviteConsultant,
  inviteExistingConsultant,
  listRecommendedConsultants,
  MAX_CONSULTANTS_PER_CATEGORY,
  type RecommendedConsultant,
} from "@/lib/invite-consultant.functions";

export const Route = createFileRoute("/projects/$id")({
  head: () => ({
    meta: [
      { title: "Project — TenderX" },
      {
        name: "description",
        content:
          "View your development project, its confirmed consultant categories, and invite consultants to submit comparable quotes.",
      },
      { property: "og:title", content: "Project — TenderX" },
      {
        property: "og:description",
        content:
          "View your development project, its confirmed consultant categories, and invite consultants to submit comparable quotes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectDetailPage,
});

type Project = {
  id: string;
  name: string;
  address: string;
  postcode: string | null;
  current_phase: string | null;
};
type CategoryRow = {
  categoryId: string;
  name: string;
  phase: string | null;
  isContinuing: boolean;
  confirmedAt: string;
};
type PhaseRow = { phase: string; startedAt: string };
type Invite = {
  id: string;
  categoryId: string;
  status: string;
  inviteToken: string;
  consultantName: string;
  consultantEmail: string;
  feeAmount: number | null;
  paymentTerms: string | null;
  startAvailability: string | null;
  turnaround: string | null;
};

function ProjectDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const invite = useServerFn(inviteConsultant);
  const inviteExisting = useServerFn(inviteExistingConsultant);
  const listRecommended = useServerFn(listRecommendedConsultants);
  const runDeleteProject = useServerFn(deleteProject);
  const runRemoveInvite = useServerFn(removeConsultantInvite);

  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<Project | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [phases, setPhases] = useState<PhaseRow[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [scopeItems, setScopeItems] = useState<
    { id: string; categoryId: string; text: string }[]
  >([]);
  const [appointing, setAppointing] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [mode, setMode] = useState<"choose" | "own" | "network">("choose");
  const [recommended, setRecommended] = useState<RecommendedConsultant[] | null>(null);
  const [loadingRecommended, setLoadingRecommended] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ url: string; sent: boolean; error?: string | undefined } | null>(null);
  const [removingInvite, setRemovingInvite] = useState<string | null>(null);

  // Navigation state
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Delete project
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Continue to next phase
  const [phasePickerOpen, setPhasePickerOpen] = useState(false);
  const [startingPhase, setStartingPhase] = useState<string | null>(null);
  const [phaseError, setPhaseError] = useState<string | null>(null);
  const [activePhaseStep, setActivePhaseStep] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: proj } = await supabase
      .from("projects")
      .select("id, name, address, postcode, current_phase")
      .eq("id", id)
      .maybeSingle();
    setProject(proj ?? null);

    const { data: phaseRows } = await supabase
      .from("project_phases")
      .select("phase, started_at")
      .eq("project_id", id)
      .order("started_at", { ascending: true });
    setPhases(
      (phaseRows ?? []).map((p) => ({ phase: p.phase, startedAt: p.started_at })),
    );

    const { data: cats } = await supabase
      .from("project_categories")
      .select("category_id, phase, created_at, consultant_categories(id, name, is_continuing)")
      .eq("project_id", id)
      .eq("status", "confirmed");

    setCategories(
      (cats ?? [])
        .map((row) => {
          const cat = row.consultant_categories as
            | { id: string; name: string; is_continuing: boolean }
            | null;
          return cat
            ? {
                categoryId: cat.id,
                name: cat.name,
                phase: row.phase,
                isContinuing: Boolean(cat.is_continuing),
                confirmedAt: row.created_at,
              }
            : null;
        })
        .filter((c): c is CategoryRow => c !== null)
        .sort((a, b) => a.name.localeCompare(b.name)),
    );

    const { data: quoteRows } = await supabase
      .from("quotes")
      .select(
        "id, category_id, status, invite_token, fee_amount, payment_terms, start_availability, turnaround, consultants(name, email)",
      )
      .eq("project_id", id)
      .order("created_at", { ascending: true });

    setInvites(
      (quoteRows ?? []).map((q) => {
        const c = q.consultants as { name: string; email: string } | null;
        return {
          id: q.id,
          categoryId: q.category_id,
          status: q.status,
          inviteToken: q.invite_token,
          consultantName: c?.name ?? "Consultant",
          consultantEmail: c?.email ?? "",
          feeAmount: q.fee_amount,
          paymentTerms: q.payment_terms,
          startAvailability: q.start_availability,
          turnaround: q.turnaround,
        };
      }),
    );

    const { data: scopeRows } = await supabase
      .from("rfq_scope_items")
      .select("id, category_id, item_text, position")
      .eq("project_id", id)
      .order("position", { ascending: true });

    setScopeItems(
      (scopeRows ?? []).map((s) => ({
        id: s.id,
        categoryId: s.category_id,
        text: s.item_text,
      })),
    );

    setLoading(false);

  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  function closePanel() {
    setOpenCategory(null);
    setMode("choose");
    setRecommended(null);
    setFormError(null);
  }

  async function openNetwork(categoryId: string) {
    setMode("network");
    setFormError(null);
    setLoadingRecommended(true);
    try {
      const rows = await listRecommended({ data: { projectId: id, categoryId } });
      setRecommended(rows);
    } catch {
      setRecommended([]);
    } finally {
      setLoadingRecommended(false);
    }
  }

  async function handleInvite(e: React.FormEvent, categoryId: string) {
    e.preventDefault();
    setFormError(null);
    setNotice(null);
    setSending(true);
    try {
      const result = await invite({
        data: {
          projectId: id,
          categoryId,
          name,
          email,
          origin: window.location.origin,
        },
      });
      setNotice({ url: result.inviteUrl, sent: result.emailSent, error: result.emailError });
      setName("");
      setEmail("");
      closePanel();
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function handleInviteExisting(categoryId: string, consultantId: string) {
    setFormError(null);
    setNotice(null);
    setSending(true);
    try {
      const result = await inviteExisting({
        data: { projectId: id, categoryId, consultantId, origin: window.location.origin },
      });
      setNotice({ url: result.inviteUrl, sent: result.emailSent, error: result.emailError });
      closePanel();
      await load();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not send the invite.");
    } finally {
      setSending(false);
    }
  }

  async function handleRemoveInvite(quoteId: string) {
    if (!window.confirm("Remove this consultant from this category?")) return;
    setRemovingInvite(quoteId);
    try {
      await runRemoveInvite({ data: { projectId: id, quoteId } });
      setInvites((prev) => prev.filter((i) => i.id !== quoteId));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not remove this consultant.",
      );
    } finally {
      setRemovingInvite(null);
    }
  }

  async function handleAppoint(quoteId: string) {
    setAppointing(quoteId);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({ status: "accepted" })
        .eq("id", quoteId)
        .eq("project_id", id);
      if (error) throw new Error(error.message);
      setInvites((prev) =>
        prev.map((i) => (i.id === quoteId ? { ...i, status: "accepted" } : i)),
      );
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Could not appoint this consultant.",
      );
    } finally {
      setAppointing(null);
    }
  }


  async function handleDeleteProject() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await runDeleteProject({ data: { projectId: id } });
      void navigate({ to: "/projects" });
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete this project.",
      );
      setDeleting(false);
    }
  }

  async function startPhase(phase: string) {
    setPhaseError(null);
    setStartingPhase(phase);

    const { error: phaseInsertError } = await supabase
      .from("project_phases")
      .insert({ project_id: id, phase });

    if (phaseInsertError && !phaseInsertError.message.includes("duplicate")) {
      setPhaseError(phaseInsertError.message);
      setStartingPhase(null);
      return;
    }

    const { error: updateError } = await supabase
      .from("projects")
      .update({ current_phase: phase })
      .eq("id", id);

    if (updateError) {
      setPhaseError(updateError.message);
      setStartingPhase(null);
      return;
    }

    setStartingPhase(null);
    setPhasePickerOpen(false);
    setActivePhaseStep(phase);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">
          This project doesn't exist, or you don't have access to it.
        </p>
      </div>
    );
  }

  // Phases to display, in engaged order, plus any phase that has categories but no log row.
  const phaseNames = phases.map((phase) => phase.phase);
  const displayPhases: string[] = [...phaseNames];
  for (const cat of categories) {
    const p = cat.phase ?? project.current_phase ?? "Other";
    if (!displayPhases.includes(p)) displayPhases.push(p);
  }
  if (displayPhases.length === 0 && project.current_phase) {
    displayPhases.push(project.current_phase);
  }


  const availablePhases = PHASES.filter((p) => !phaseNames.includes(p.value));
  const nextPhase = suggestedNextPhase(phaseNames);

  if (activePhaseStep) {
    return (
      <div className="min-h-screen bg-background px-4 py-16 sm:py-24">
        <div className="mx-auto w-full max-w-xl">
          <CategorySuggestionStep
            projectId={id}
            phase={activePhaseStep}
            heading={activePhaseStep}
            excludeCategoryIds={categories.map((c) => c.categoryId)}
            onContinue={() => {
              setActiveTab(activePhaseStep);
              setActiveCategory(null);
              setActivePhaseStep(null);
              setLoading(true);
              void load();
            }}
          />
        </div>
      </div>
    );
  }

  const currentTab =
    activeTab && displayPhases.includes(activeTab)
      ? activeTab
      : (displayPhases[0] ?? null);

  const tabCategories =
    currentTab === null
      ? []
      : categories.filter(
          (c) => (c.phase ?? project.current_phase ?? "Other") === currentTab,
        );

  const currentCategory =
    tabCategories.find((c) => c.categoryId === activeCategory) ?? tabCategories[0] ?? null;

  const categoryById = new Map(categories.map((c) => [c.categoryId, c]));
  const appointed = invites.filter((i) => i.status === "accepted");

  function selectTab(tab: string) {
    setActiveTab(tab);
    setActiveCategory(null);
    closePanel();
  }


  function renderCategoryDetail(cat: CategoryRow) {
    const catInvites = invites.filter((i) => i.categoryId === cat.categoryId);
    const full = catInvites.length >= MAX_CONSULTANTS_PER_CATEGORY;
    const remaining = MAX_CONSULTANTS_PER_CATEGORY - catInvites.length;
    const isOpen = openCategory === cat.categoryId;
    const submitted = catInvites.filter((i) => i.status === "submitted");

    return (
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-medium text-foreground">{cat.name}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {catInvites.length} of {MAX_CONSULTANTS_PER_CATEGORY} consultants invited
            </p>
          </div>
          <button
            type="button"
            disabled={full}
            onClick={() =>
              isOpen ? closePanel() : (setOpenCategory(cat.categoryId), setMode("choose"))
            }
            className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOpen ? "Cancel" : "Invite Consultant"}
          </button>
        </div>

        {full && (
          <p className="mt-2 text-xs text-muted-foreground">
            Maximum of 4 consultants reached for this category.
          </p>
        )}

        <ScopeOfWork projectId={id} categoryId={cat.categoryId} />

        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Invited Consultants
          </h4>
          {catInvites.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No consultants invited for this category yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-border rounded-md border border-border">
              {catInvites.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="truncate text-muted-foreground">
                    {i.consultantName} <span className="text-xs">({i.consultantEmail})</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full border border-border px-2 py-0.5 text-xs capitalize text-muted-foreground">
                      {i.status}
                    </span>
                    {i.status === "submitted" && (
                      <button
                        type="button"
                        disabled={appointing === i.id}
                        onClick={() => void handleAppoint(i.id)}
                        className="rounded-md border border-input px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                      >
                        {appointing === i.id ? "Appointing…" : "Appoint"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={removingInvite === i.id}
                      onClick={() => void handleRemoveInvite(i.id)}
                      aria-label={`Remove ${i.consultantName}`}
                      title="Remove consultant"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
                    >
                      <TrashIcon />
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {submitted.length > 1 && (
          <div className="mt-6">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quote Comparison
            </h4>
            <div className="mt-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Consultant</th>
                    <th className="px-3 py-2 font-medium">Fee (AUD)</th>
                    <th className="px-3 py-2 font-medium">Payment terms</th>
                    <th className="px-3 py-2 font-medium">Available</th>
                    <th className="px-3 py-2 font-medium">Turnaround</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submitted.map((q) => (
                    <tr key={q.id}>
                      <td className="px-3 py-2 text-foreground">{q.consultantName}</td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {q.feeAmount === null
                          ? "—"
                          : `$${Number(q.feeAmount).toLocaleString("en-AU")}`}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {q.paymentTerms ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {q.startAvailability ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{q.turnaround ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isOpen && !full && (
          <div className="mt-6 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground">
              {remaining} of {MAX_CONSULTANTS_PER_CATEGORY} slots remaining
            </p>

            {mode === "choose" && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setMode("own")}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  Invite your own
                </button>
                <button
                  type="button"
                  onClick={() => void openNetwork(cat.categoryId)}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
                >
                  Platform recommendations
                </button>
              </div>
            )}

            {mode === "network" && (
              <div className="mt-4">
                {loadingRecommended ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : !recommended || recommended.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No matching consultants in our network yet for this category/area.
                  </p>
                ) : (
                  <RecommendationList
                    rows={recommended}
                    sending={sending}
                    onInvite={(consultantId) =>
                      void handleInviteExisting(cat.categoryId, consultantId)
                    }
                  />
                )}
                {formError && (
                  <p className="mt-3 text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                )}
              </div>
            )}

            {mode === "own" && (
              <form onSubmit={(e) => handleInvite(e, cat.categoryId)} className="mt-4 space-y-4">
                <div className="space-y-2">
                  <label
                    htmlFor={`invite-name-${cat.categoryId}`}
                    className="block text-sm font-medium text-foreground"
                  >
                    Name
                  </label>
                  <input
                    id={`invite-name-${cat.categoryId}`}
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label
                    htmlFor={`invite-email-${cat.categoryId}`}
                    className="block text-sm font-medium text-foreground"
                  >
                    Email
                  </label>
                  <input
                    id={`invite-email-${cat.categoryId}`}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
                {formError && (
                  <p className="text-sm text-destructive" role="alert">
                    {formError}
                  </p>
                )}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={sending}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                  >
                    {sending ? "Sending…" : "Send Invite"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/projects" className="text-lg font-semibold tracking-tight text-foreground">
            TenderX
          </Link>
          <Link
            to="/projects/new"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            New Project
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <BackIcon />
          Back to projects
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {project.name}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {project.address}
              {project.postcode ? ` · ${project.postcode}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            Delete Project
          </button>
        </div>

        {confirmDelete && (
          <div
            role="alertdialog"
            aria-label="Delete project"
            className="mt-6 rounded-md border border-destructive/40 bg-destructive/5 p-4"
          >
            <p className="text-sm font-medium text-foreground">Delete this project?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This will permanently delete this project and all its data. This cannot be undone.
            </p>
            {deleteError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {deleteError}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleDeleteProject()}
                disabled={deleting}
                className="rounded-md bg-destructive px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete Project"}
              </button>
            </div>
          </div>
        )}

        {notice && (
          <div className="mt-8 rounded-md border border-border bg-muted/40 p-4 text-sm">
            <p className="text-foreground">
              {notice.sent ? "Invite email sent." : "Invite created, but the email wasn't sent."}
            </p>
            {!notice.sent && notice.error && (
              <p className="mt-1 text-xs text-muted-foreground">{notice.error}</p>
            )}
            <p className="mt-2 break-all text-xs text-muted-foreground">{notice.url}</p>
          </div>
        )}

        {/* Project Team is rendered below the phase tabs — see end of main. */}

        <section className="mt-6">
          <div
            role="tablist"
            aria-label="Project phases"
            className="flex flex-wrap items-center gap-1 border-b border-border"
          >
            {displayPhases.map((phaseName) => {
              const selected = currentTab === phaseName;
              return (
                <button
                  key={phaseName}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => selectTab(phaseName)}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    selected
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {phaseName}
                </button>
              );
            })}
            {availablePhases.length > 0 && (
              <button
                type="button"
                onClick={() => setPhasePickerOpen((v) => !v)}
                className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {phasePickerOpen ? "Cancel" : "+ Add Phase"}
              </button>
            )}
          </div>

          {phasePickerOpen && availablePhases.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground">Continue to Next Phase</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add the consultants you'll need for the next stage of this project.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {availablePhases.map((p) => {
                  const isSuggested = p.value === nextPhase;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      disabled={startingPhase !== null}
                      onClick={() => void startPhase(p.value)}
                      className={`flex-1 basis-[calc(50%-0.5rem)] min-w-[240px] rounded-md border p-3 text-left transition-colors disabled:opacity-60 ${
                        isSuggested
                          ? "border-ring bg-accent/30 ring-1 ring-ring/30"
                          : "border-input bg-background hover:border-ring/60 hover:bg-accent/30"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{p.value}</span>
                        {isSuggested && (
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                            Suggested next
                          </span>
                        )}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {p.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              {startingPhase && (
                <p className="mt-3 text-sm text-muted-foreground">Starting {startingPhase}…</p>
              )}
              {phaseError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {phaseError}
                </p>
              )}
            </div>
          )}

          {displayPhases.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">
              No phases started yet on this project.
            </p>
          ) : (
            <div className="mt-6">

              {tabCategories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No confirmed consultant categories for this phase yet.
                </p>
              ) : (
                <>
                  <div
                    role="tablist"
                    aria-label="Phase categories"
                    className="flex flex-wrap gap-2"
                  >
                    {tabCategories.map((cat) => {
                      const selected = currentCategory?.categoryId === cat.categoryId;
                      return (
                        <button
                          key={cat.categoryId}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => {
                            setActiveCategory(cat.categoryId);
                            closePanel();
                          }}
                          className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                            selected
                              ? "border-foreground bg-accent/50 font-medium text-foreground"
                              : "border-input text-muted-foreground hover:bg-accent hover:text-foreground"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>

                  {currentCategory && (
                    <div className="mt-4 rounded-md border border-border">
                      {renderCategoryDetail(currentCategory)}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>

        <section id="project-team" className="mt-12 scroll-mt-6 border-t border-border pt-8">
          <h2 className="text-lg font-medium text-foreground">Appointed Project Team</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone appointed on this project, across every category and phase.
          </p>
          {appointed.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No consultants appointed yet.
            </p>
          ) : (
            <div className="mt-4 divide-y divide-border rounded-md border border-border">
              {appointed.map((row) => {
                const cat = categoryById.get(row.categoryId);
                return (
                  <AppointedRow
                    key={row.id}
                    invite={row}
                    categoryName={cat?.name ?? "Consultant"}
                    phase={cat?.phase ?? project.current_phase ?? "—"}
                    scope={scopeItems.filter((s) => s.categoryId === row.categoryId)}
                  />
                );
              })}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}

function AppointedRow({
  invite,
  categoryName,
  phase,
  scope,
}: {
  invite: Invite;
  categoryName: string;
  phase: string;
  scope: { id: string; text: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/40"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-foreground">
            {invite.consultantName}
          </span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {categoryName} · {phase}
          </span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            className={open ? "" : "-rotate-90"}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/20 p-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs text-muted-foreground">Fee (AUD)</dt>
              <dd className="text-foreground">
                {invite.feeAmount === null
                  ? "—"
                  : `$${Number(invite.feeAmount).toLocaleString("en-AU")}`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Payment terms</dt>
              <dd className="text-foreground">{invite.paymentTerms ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Available</dt>
              <dd className="text-foreground">{invite.startAvailability ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Turnaround</dt>
              <dd className="text-foreground">{invite.turnaround ?? "—"}</dd>
            </div>
          </dl>

          <h4 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Scope of Work
          </h4>
          {scope.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No scope items for this category yet.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {scope.map((s) => (
                <li key={s.id} className="flex items-start gap-2 text-sm text-foreground">
                  <span
                    aria-hidden
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground"
                  />
                  <span>{s.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationList({
  rows,
  sending,
  onInvite,
}: {
  rows: RecommendedConsultant[];
  sending: boolean;
  onInvite: (consultantId: string) => void;
}) {
  const same = rows.filter((r) => r.samePostcode);
  const other = rows.filter((r) => !r.samePostcode);
  const groups: { label: string; rows: RecommendedConsultant[] }[] = [];
  if (same.length > 0) groups.push({ label: "Same postcode", rows: same });
  if (other.length > 0) groups.push({ label: "Other areas", rows: other });

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {group.label}
          </p>
          <ul className="mt-2 divide-y divide-border rounded-md border border-border bg-background">
            {group.rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-4 p-3">
                <span className="truncate text-sm text-foreground">
                  {r.name} <span className="text-xs text-muted-foreground">({r.email})</span>
                </span>
                <button
                  type="button"
                  disabled={sending}
                  onClick={() => onInvite(r.id)}
                  className="shrink-0 rounded-md border border-input px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
                >
                  Invite
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

const inputClass =
  "block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";
