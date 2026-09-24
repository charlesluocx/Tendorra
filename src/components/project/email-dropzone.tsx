"use client";

import { useRef, useState } from "react";
import type { UploadState } from "@/app/(dashboard)/projects/[id]/actions";

type FileStatus = {
  key: string;
  name: string;
  state: "uploading" | "done" | "error";
  message: string | null;
};

export function EmailDropzone({
  projectId,
  action,
}: {
  projectId: string;
  action: (prevState: UploadState, formData: FormData) => Promise<UploadState>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const key = `${file.name}-${Date.now()}-${Math.random()}`;
      setStatuses((prev) => [{ key, name: file.name, state: "uploading", message: null }, ...prev]);

      const formData = new FormData();
      formData.set("project_id", projectId);
      formData.set("file", file);

      try {
        const result = await action({ error: null, result: null }, formData);
        setStatuses((prev) =>
          prev.map((s) =>
            s.key === key
              ? { ...s, state: result.error ? "error" : "done", message: result.error ?? result.result }
              : s,
          ),
        );
      } catch (err) {
        setStatuses((prev) =>
          prev.map((s) =>
            s.key === key
              ? { ...s, state: "error", message: err instanceof Error ? err.message : "Upload failed." }
              : s,
          ),
        );
      }
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-4 py-6 text-center transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-border bg-muted/40 hover:bg-muted/60"
        }`}
      >
        <p className="text-sm font-medium text-foreground">
          Drag an email here to log it on this timeline
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Drag straight from Outlook desktop, or drop a .eml/.msg file — or click to browse
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".eml,.msg"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {statuses.length > 0 && (
        <ul className="mt-2 space-y-1">
          {statuses.map((s) => (
            <li key={s.key} className="text-xs">
              <span className="text-foreground">{s.name}</span>{" "}
              {s.state === "uploading" && <span className="text-muted-foreground">Uploading…</span>}
              {s.state === "done" && <span className="text-muted-foreground">{s.message}</span>}
              {s.state === "error" && <span className="text-destructive">{s.message}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
