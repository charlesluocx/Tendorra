import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateScope } from "@/lib/scope.functions";

type ScopeItem = {
  id: string;
  item_text: string;
  source: string;
  position: number;
};

export function ScopeOfWork({
  projectId,
  categoryId,
}: {
  projectId: string;
  categoryId: string;
}) {
  const runGenerate = useServerFn(generateScope);

  const [items, setItems] = useState<ScopeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("rfq_scope_items")
      .select("id, item_text, source, position")
      .eq("project_id", projectId)
      .eq("category_id", categoryId)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, [projectId, categoryId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleGenerate() {
    setGenerating(true);
    setMessage(null);
    try {
      const result = await runGenerate({ data: { projectId, categoryId } });
      if (result.status === "not_configured") {
        setMessage("AI scope generation isn't configured yet.");
      } else if (result.status === "failed") {
        setMessage(result.message);
      } else {
        await load();
      }
    } catch {
      setMessage("We couldn't draft the scope. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveItem(item: ScopeItem, text: string) {
    const trimmed = text.trim();
    if (!trimmed || trimmed === item.item_text) return;
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, item_text: trimmed, source: "owner_edited" } : i,
      ),
    );
    await supabase
      .from("rfq_scope_items")
      .update({ item_text: trimmed, source: "owner_edited" })
      .eq("id", item.id);
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    await supabase.from("rfq_scope_items").delete().eq("id", id);
  }

  async function addItem() {
    const text = newItem.trim();
    if (!text) return;
    const position = items.length > 0 ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    const { data } = await supabase
      .from("rfq_scope_items")
      .insert({
        project_id: projectId,
        category_id: categoryId,
        item_text: text,
        source: "owner_edited",
        position,
      })
      .select("id, item_text, source, position")
      .single();
    if (data) setItems((prev) => [...prev, data]);
    setNewItem("");
  }

  if (loading) {
    return <p className="mt-3 text-xs text-muted-foreground">Loading scope…</p>;
  }

  return (
    <div className="mt-4 rounded-md border border-border bg-muted/20 p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scope of Work
          {items.length > 0 && (
            <span className="ml-2 font-normal normal-case tracking-normal">
              ({items.length})
            </span>
          )}
        </h3>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? "Expand scope of work" : "Collapse scope of work"}
          title={collapsed ? "Expand scope of work" : "Collapse scope of work"}
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <ChevronIcon open={!collapsed} />
        </button>
      </div>

      {collapsed ? null : items.length === 0 ? (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            We'll draft a scope based on your project details — you can edit it before
            sending.
          </p>
          <button
            type="button"
            onClick={() => void handleGenerate()}
            disabled={generating}
            className="mt-3 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60"
          >
            {generating ? "Drafting…" : "Generate Scope with AI"}
          </button>
          <p className="mt-2 text-xs text-muted-foreground">
            AI-drafted — please review before sending to consultants.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="flex items-start gap-2">
                <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-muted-foreground" />
                <textarea
                  defaultValue={item.item_text}
                  onBlur={(e) => void saveItem(item, e.target.value)}
                  rows={2}
                  aria-label="Scope item"
                  className="min-h-[2.5rem] w-full resize-y rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-foreground outline-none hover:border-input focus:border-ring focus:bg-background focus:ring-2 focus:ring-ring/30"
                />
                <button
                  type="button"
                  onClick={() => void deleteItem(item.id)}
                  aria-label="Delete scope item"
                  title="Delete item"
                  className="mt-1 shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <TrashIcon />
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addItem();
                }
              }}
              placeholder="Add a scope item"
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30"
            />
            <button
              type="button"
              onClick={() => void addItem()}
              className="shrink-0 rounded-md border border-input px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              + Add item
            </button>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            AI-drafted — please review before sending to consultants.
          </p>
        </div>
      )}

      {message && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
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
      className={open ? "" : "-rotate-90"}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
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
