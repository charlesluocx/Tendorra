import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { suggestCategories } from "@/lib/suggest-categories.functions";

type Category = { id: string; name: string };
type Selected = { name: string; reason: string | null; source: string };

const GROUPS: { title: string; names: string[] }[] = [
  {
    title: "Feasibility & Concept",
    names: [
      "Architect",
      "Town Planner",
      "Land Surveyor",
      "Arborist",
      "Quantity Surveyor",
    ],
  },
  {
    title: "Planning & Approval – Specialist Reports",
    names: [
      "Traffic Engineer",
      "Acoustic Consultant",
      "Waste Management Consultant",
      "Heritage Consultant",
      "Bushfire Consultant",
      "Native Vegetation/Ecology Consultant",
      "Environmental/Contamination Consultant",
      "Landscape Architect",
      "Urban Designer",
      "ESD/Sustainability Consultant",
      "Access Consultant",
    ],
  },
  {
    title: "Engineering & Delivery",
    names: [
      "Structural Engineer",
      "Civil Engineer",
      "Geotechnical Engineer",
      "Building Surveyor",
      "Fire Engineer",
      "MEP Engineer",
      "Project Manager",
    ],
  },
  {
    title: "Sales, Legal & Ownership",
    names: [
      "Sales/Project Marketing Agent",
      "Conveyancer/Property Lawyer",
      "Owners Corporation Manager",
    ],
  },
];

const SCHEMATIC_CATEGORIES = ["Architect", "Town Planner"];

export function CategorySuggestionStep({
  projectId,
  phase,
  onContinue,
  excludeCategoryIds,
  heading,
}: {
  projectId: string;
  phase: string;
  onContinue: () => void;
  excludeCategoryIds?: string[];
  heading?: string;
}) {
  const excludedKey = (excludeCategoryIds ?? []).join(",");
  const isSchematic = phase === "Schematic";
  const runSuggest = useServerFn(suggestCategories);

  const [loading, setLoading] = useState(true);
  const [aiFailed, setAiFailed] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suggested, setSuggested] = useState<
    { categoryId: string; name: string; reason: string }[]
  >([]);
  const [selected, setSelected] = useState<Record<string, Selected>>({});
  const [browseOpen, setBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [customName, setCustomName] = useState("");
  const [customError, setCustomError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const excluded = new Set(excludedKey ? excludedKey.split(",") : []);
      const { data: allCats } = await supabase
        .from("consultant_categories")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      const cats = (allCats ?? []).filter((c) => !excluded.has(c.id));
      if (!cancelled) setCategories(cats);

      if (isSchematic) {
        const picks = (cats ?? []).filter((c) => SCHEMATIC_CATEGORIES.includes(c.name));
        if (!cancelled) {
          setSuggested(picks.map((c) => ({ categoryId: c.id, name: c.name, reason: "" })));
          setSelected(
            Object.fromEntries(
              picks.map((c) => [c.id, { name: c.name, reason: null, source: "owner_added" }]),
            ),
          );
          setLoading(false);
        }
        return;
      }

      try {
        const result = await runSuggest({ data: { projectId } });
        if (cancelled) return;
        const fresh = result.suggestions.filter((s) => !excluded.has(s.categoryId));
        if (result.failed || fresh.length === 0) {
          setAiFailed(true);
          setBrowseOpen(true);
        } else {
          setSuggested(fresh);
          setSelected(
            Object.fromEntries(
              fresh.map((s) => [
                s.categoryId,
                { name: s.name, reason: s.reason, source: "ai_suggested" },
              ]),
            ),
          );
        }
      } catch {
        if (!cancelled) {
          setAiFailed(true);
          setBrowseOpen(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, runSuggest, isSchematic, excludedKey]);

  const filteredGroups = useMemo(() => {
    const byName = new Map(categories.map((c) => [c.name, c]));
    const grouped = GROUPS.map((g) => ({
      title: g.title,
      items: g.names.map((n) => byName.get(n)).filter((c): c is Category => Boolean(c)),
    }));
    const listed = new Set(GROUPS.flatMap((g) => g.names));
    const others = categories.filter((c) => !listed.has(c.name));
    if (others.length > 0) grouped.push({ title: "Other", items: others });
    const q = search.trim().toLowerCase();
    return grouped
      .map((g) => ({
        title: g.title,
        items: q ? g.items.filter((c) => c.name.toLowerCase().includes(q)) : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [categories, search]);

  function toggle(categoryId: string, name: string, reason: string | null, source: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[categoryId]) delete next[categoryId];
      else next[categoryId] = { name, reason, source };
      return next;
    });
  }

  async function addCustom() {
    const name = customName.trim();
    if (!name) return;
    setCustomError(null);

    const existing = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      setSelected((prev) => ({
        ...prev,
        [existing.id]: { name: existing.name, reason: null, source: "owner_added" },
      }));
      setCustomName("");
      return;
    }

    const { data: match } = await supabase
      .from("consultant_categories")
      .select("id, name")
      .ilike("name", name)
      .maybeSingle();

    if (match) {
      setCategories((prev) =>
        prev.some((c) => c.id === match.id) ? prev : [...prev, match],
      );
      setSelected((prev) => ({
        ...prev,
        [match.id]: { name: match.name, reason: null, source: "owner_added" },
      }));
      setCustomName("");
      return;
    }

    const { data: userData } = await supabase.auth.getUser();
    const { data: created, error: createError } = await supabase
      .from("consultant_categories")
      .insert({
        name,
        is_predefined: false,
        status: "pending_review",
        created_by: userData.user?.id ?? null,
      })
      .select("id, name")
      .single();

    if (createError || !created) {
      setCustomError(createError?.message ?? "Could not add that category.");
      return;
    }

    setSelected((prev) => ({
      ...prev,
      [created.id]: { name: created.name, reason: null, source: "owner_custom" },
    }));
    setCustomName("");
  }

  async function handleContinue() {
    setSaving(true);
    setError(null);

    const rows = Object.entries(selected).map(([categoryId, value]) => ({
      project_id: projectId,
      category_id: categoryId,
      reason: value.reason,
      source: value.source,
      status: "confirmed",
      phase,
    }));

    if (rows.length > 0) {
      const { error: upsertError } = await supabase
        .from("project_categories")
        .upsert(rows, { onConflict: "project_id,category_id" });
      if (upsertError) {
        setError(upsertError.message);
        setSaving(false);
        return;
      }
    }

    const removed = suggested
      .map((s) => s.categoryId)
      .filter((id) => !selected[id]);
    if (removed.length > 0) {
      await supabase
        .from("project_categories")
        .update({ status: "removed" })
        .eq("project_id", projectId)
        .in("category_id", removed);
    }

    setSaving(false);
    onContinue();
  }

  if (loading) {
    return (
      <div className="py-8">
        <p className="text-sm text-muted-foreground">
          Reviewing your project and suggesting consultants…
        </p>
      </div>
    );
  }

  return (
    <>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          {heading ?? "Suggested Consultants"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {isSchematic
            ? "At the schematic stage, these are the consultants you'll need:"
            : aiFailed
              ? "We couldn't generate suggestions — please select the consultants you'll need."
              : "Based on your project, we think you'll need:"}
        </p>
      </header>

      {suggested.length > 0 && (
        <ul className="mt-10 divide-y divide-border rounded-md border border-border">
          {suggested.map((s) => (
            <li key={s.categoryId} className="flex items-start gap-3 px-4 py-4">
              <input
                id={`suggested-${s.categoryId}`}
                type="checkbox"
                checked={Boolean(selected[s.categoryId])}
                onChange={() =>
                  toggle(
                    s.categoryId,
                    s.name,
                    s.reason || null,
                    isSchematic ? "owner_added" : "ai_suggested",
                  )
                }
                className="mt-1 size-4 shrink-0 rounded border-input accent-primary"
              />
              <label htmlFor={`suggested-${s.categoryId}`} className="cursor-pointer">
                <span className="block text-sm font-medium text-foreground">{s.name}</span>
                {s.reason && (
                  <span className="mt-1 block text-sm text-muted-foreground">{s.reason}</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      )}

      {Object.keys(selected).some((id) => !suggested.some((s) => s.categoryId === id)) && (
        <div className="mt-6">
          <h2 className="text-sm font-medium text-foreground">Also added</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {Object.entries(selected)
              .filter(([id]) => !suggested.some((s) => s.categoryId === id))
              .map(([id, value]) => (
                <li key={id}>
                  <button
                    type="button"
                    onClick={() => toggle(id, value.name, value.reason, value.source)}
                    className="rounded-full border border-border px-3 py-1 text-xs text-foreground hover:bg-accent/40"
                  >
                    {value.name} ×
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="mt-10 space-y-6 border-t border-border pt-8">
        {!isSchematic && (
          <div>
          <button
            type="button"
            onClick={() => setBrowseOpen((v) => !v)}
            className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            {browseOpen ? "Hide all categories" : "Browse all categories"}
          </button>

          {browseOpen && (
            <div className="mt-4 space-y-6">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories"
                className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
              />

              {filteredGroups.map((group) => (
                <div key={group.title}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.title}
                  </h3>
                  <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                    {group.items.map((c) => {
                      const isSelected = Boolean(selected[c.id]);
                      return (
                        <li
                          key={c.id}
                          className="flex items-center justify-between gap-4 px-4 py-2.5"
                        >
                          <span className="text-sm text-foreground">{c.name}</span>
                          {isSelected ? (
                            <span className="text-xs text-muted-foreground">Added</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => toggle(c.id, c.name, null, "owner_added")}
                              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
                            >
                              Add
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
          </div>
        )}

        <div>
          <label
            htmlFor="custom-category"
            className="block text-sm font-medium text-foreground"
          >
            Add a custom category
          </label>
          <div className="mt-2 flex gap-2">
            <input
              id="custom-category"
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Wind Engineer"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              onClick={addCustom}
              className="shrink-0 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-accent/40"
            >
              Add
            </button>
          </div>
          {customError && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {customError}
            </p>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-6 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="mt-10 flex justify-end">
        <button
          type="button"
          onClick={handleContinue}
          disabled={saving}
          className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </>
  );
}
