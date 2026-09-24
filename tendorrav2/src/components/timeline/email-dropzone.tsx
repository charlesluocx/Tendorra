"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEmailFile, parseEmailFile, parseText, type ParsedEmail } from "@/lib/email/parse";

type Job = {
  id: string;
  label: string;
  state: "parsing" | "uploading" | "analysing" | "done" | "duplicate" | "error";
  detail?: string;
};

const STATE_TEXT: Record<Job["state"], string> = {
  parsing: "Reading…",
  uploading: "Uploading…",
  analysing: "Claude is reading the email…",
  done: "Added",
  duplicate: "Already on this timeline",
  error: "Failed",
};

export function EmailDropzone({ orgId, projectId }: { orgId: string; projectId: string }) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const update = (id: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)));

  const ingest = useCallback(
    async (jobId: string, email: ParsedEmail, file: File | null) => {
      let storagePath: string | null = null;
      if (file) {
        update(jobId, { state: "uploading" });
        const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
        const path = `${orgId}/${projectId}/${crypto.randomUUID()}-${safeName}`;
        const { error } = await createClient().storage.from("emails").upload(path, file, {
          contentType: file.type || "application/octet-stream",
        });
        // A failed upload shouldn't block the timeline; we still keep the parsed content.
        if (!error) storagePath = path;
      }
      update(jobId, { state: "analysing", label: email.subject });
      const res = await fetch("/api/emails/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, storagePath, email }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Server error ${res.status}`);
      if (body.duplicate) {
        if (storagePath) await createClient().storage.from("emails").remove([storagePath]);
        update(jobId, { state: "duplicate" });
        return;
      }
      const items = (body.items ?? []) as { kind: string }[];
      const milestones = items.filter((i) => i.kind === "milestone").length;
      update(jobId, {
        state: "done",
        detail:
          `${items.length} entr${items.length === 1 ? "y" : "ies"}` +
          (milestones ? `, ${milestones} milestone${milestones === 1 ? "" : "s"}` : "") +
          (body.warning ? ` · ${body.warning}` : ""),
      });
    },
    [orgId, projectId],
  );

  const processFiles = useCallback(
    async (files: File[]) => {
      const accepted = files.filter((f) => isEmailFile(f) || f.name.toLowerCase().endsWith(".txt"));
      const rejected = files.filter((f) => !accepted.includes(f));
      const newJobs: Job[] = [
        ...accepted.map((f) => ({ id: crypto.randomUUID(), label: f.name, state: "parsing" as const })),
        ...rejected.map((f) => ({
          id: crypto.randomUUID(),
          label: f.name,
          state: "error" as const,
          detail: "Not an email file — drop .msg (Outlook) or .eml (Gmail / Outlook web)",
        })),
      ];
      setJobs((prev) => [...newJobs, ...prev]);

      // Sequential so milestones from earlier emails inform later ones.
      for (let i = 0; i < accepted.length; i++) {
        const job = newJobs[i];
        try {
          const parsed = await parseEmailFile(accepted[i]);
          await ingest(job.id, parsed, accepted[i]);
        } catch (err) {
          update(job.id, { state: "error", detail: err instanceof Error ? err.message : String(err) });
        }
      }
      if (accepted.length) router.refresh();
    },
    [ingest, router],
  );

  const processText = useCallback(
    async (text: string) => {
      const job: Job = { id: crypto.randomUUID(), label: "Pasted email", state: "parsing" };
      setJobs((prev) => [job, ...prev]);
      try {
        await ingest(job.id, parseText(text), null);
        router.refresh();
      } catch (err) {
        update(job.id, { state: "error", detail: err instanceof Error ? err.message : String(err) });
      }
    },
    [ingest, router],
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) {
      void processFiles(files);
      return;
    }
    // Some mail clients drag the message as text instead of a file.
    const text = e.dataTransfer.getData("text/plain");
    if (text && text.trim().length > 20 && !/^https?:\/\/\S+$/.test(text.trim())) {
      void processText(text);
    } else if (text) {
      setJobs((prev) => [
        {
          id: crypto.randomUUID(),
          label: "Link dropped",
          state: "error",
          detail: "Your mail client sent a link, not the email. Download the email (.eml) or drag it to your desktop first, then drop the file here.",
        },
        ...prev,
      ]);
    }
  };

  const busy = jobs.some((j) => ["parsing", "uploading", "analysing"].includes(j.state));

  return (
    <div className="space-y-3">
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          dragDepth.current++;
          setDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDragLeave={() => {
          dragDepth.current = Math.max(0, dragDepth.current - 1);
          if (dragDepth.current === 0) setDragging(false);
        }}
        onDrop={onDrop}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragging ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white hover:border-brand-500 hover:bg-slate-50"
        }`}
      >
        <div className="text-3xl">{dragging ? "📥" : "📨"}</div>
        <p className="mt-2 font-semibold">{dragging ? "Drop to add to the timeline" : "Drag emails here"}</p>
        <p className="mt-1 max-w-lg text-sm text-slate-500">
          From Outlook, drag messages straight in (.msg). From Gmail, use ⋮ → <em>Download message</em> and drop the .eml
          file. You can drop many at once, or click to browse.
        </p>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept=".msg,.eml,.txt,message/rfc822"
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void processFiles(files);
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="text-sm text-brand-600 hover:underline" onClick={() => setPasteOpen((v) => !v)}>
          {pasteOpen ? "Hide paste box" : "…or paste the email text"}
        </button>
        {jobs.length > 0 && !busy && (
          <button type="button" className="text-xs text-slate-500 hover:text-slate-800" onClick={() => setJobs([])}>
            Clear list
          </button>
        )}
      </div>

      {pasteOpen && (
        <div className="space-y-2">
          <textarea
            className="input font-mono text-xs"
            rows={8}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"From: Jane Smith <jane@council.gov>\nSent: 3 March 2026 10:14\nSubject: DA approval\n\nHi team, …"}
          />
          <button
            type="button"
            className="btn-primary"
            disabled={pasteText.trim().length < 20}
            onClick={() => {
              void processText(pasteText);
              setPasteText("");
              setPasteOpen(false);
            }}
          >
            Add to timeline
          </button>
        </div>
      )}

      {jobs.length > 0 && (
        <ul className="card divide-y divide-slate-100 text-sm">
          {jobs.map((job) => (
            <li key={job.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <span className="min-w-0 truncate">{job.label}</span>
              <span
                className={`shrink-0 text-xs ${
                  job.state === "done"
                    ? "text-emerald-600"
                    : job.state === "error"
                      ? "text-red-600"
                      : job.state === "duplicate"
                        ? "text-amber-600"
                        : "animate-pulse text-slate-500"
                }`}
                title={job.detail}
              >
                {STATE_TEXT[job.state]}
                {job.detail ? ` — ${job.detail}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
