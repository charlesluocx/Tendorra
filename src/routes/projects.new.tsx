import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CategorySuggestionStep } from "@/components/CategorySuggestionStep";
import { PHASES } from "@/lib/phases";

export const Route = createFileRoute("/projects/new")({
  head: () => ({
    meta: [
      { title: "New Project — TenderX" },
      {
        name: "description",
        content:
          "Create a new property development project on TenderX, upload planning documents, and start collecting comparable consultant quotes.",
      },
      { property: "og:title", content: "New Project — TenderX" },
      {
        property: "og:description",
        content:
          "Create a new property development project on TenderX, upload planning documents, and start collecting comparable consultant quotes.",
      },
    ],
  }),
  component: NewProjectPage,
});

const ACCEPTED = ".pdf,image/*";


function NewProjectPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessionReady, setSessionReady] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [isPermanentUser, setIsPermanentUser] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phase, setPhase] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [step, setStep] = useState<"details" | "categories" | "profile">("details");

  // Profile step
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setIsPermanentUser(!data.session.user.is_anonymous);
        setSessionReady(true);
        return;
      }
      const { error: anonError } = await supabase.auth.signInAnonymously();
      if (cancelled) return;
      if (anonError) {
        setSessionError(
          "Guest access isn't available yet. Anonymous sign-ins need to be enabled in the Supabase Auth settings.",
        );
      }
      setSessionReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError(
        sessionError ??
          "We couldn't start a session. Please refresh and try again.",
      );
      setSubmitting(false);
      return;
    }

    const { data: project, error: insertError } = await supabase
      .from("projects")
      .insert({
        name: name.trim(),
        address: address.trim(),
        postcode: postcode.trim() || null,
        current_phase: phase,
        owner_id: user.id,
      })
      .select("id")
      .single();

    if (insertError || !project) {
      setError(insertError?.message ?? "Could not create the project. Please try again.");
      setSubmitting(false);
      return;
    }

    await supabase.from("project_phases").insert({ project_id: project.id, phase });

    for (const file of files) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `${project.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("project-documents")
        .upload(path, file);
      if (uploadError) {
        setError(`Could not upload ${file.name}: ${uploadError.message}`);
        setSubmitting(false);
        return;
      }
      const { error: docError } = await supabase.from("project_documents").insert({
        project_id: project.id,
        file_path: path,
        file_name: file.name,
      });
      if (docError) {
        setError(`Could not save ${file.name}: ${docError.message}`);
        setSubmitting(false);
        return;
      }
    }

    setProjectId(project.id);
    setStep("categories");
    setSubmitting(false);
  }

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setProfileError(null);
    setSavingProfile(true);

    const { error: updateError } = await supabase.auth.updateUser({
      email: email.trim(),
      password,
      data: { full_name: fullName.trim() },
    });

    if (updateError) {
      setProfileError(updateError.message);
      setSavingProfile(false);
      return;
    }

    navigate({ href: `/projects/${projectId}` });
  }

  if (!sessionReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-16 sm:py-24">
      <div className="mx-auto w-full max-w-xl">
        {step === "categories" && projectId ? (
          <CategorySuggestionStep
            projectId={projectId}
            phase={phase}
            onContinue={() => {
              if (isPermanentUser) {
                navigate({ href: `/projects/${projectId}` });
              } else {
                setStep("profile");
              }
            }}
          />
        ) : step === "profile" && projectId ? (
          <>
            <header>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                Complete Your Profile
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Save your project by creating a free account — nothing you've entered
                will be lost.
              </p>
            </header>

            <form onSubmit={handleProfileSubmit} className="mt-12 space-y-8">
              <Field id="profile-name" label="Name">
                <input
                  id="profile-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field id="profile-email" label="Email">
                <input
                  id="profile-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                />
              </Field>

              <Field id="profile-password" label="Password">
                <input
                  id="profile-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
              </Field>

              {profileError && (
                <p className="text-sm text-destructive" role="alert">
                  {profileError}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className={buttonClass}
                >
                  {savingProfile ? "Saving…" : "Create Account"}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <header>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">
                New Project
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Tell us the basics about your development site. You'll be able to request
                quotes from consultants once the project is set up.
              </p>
            </header>

            {sessionError && (
              <p className="mt-6 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                {sessionError}
              </p>
            )}

            <form onSubmit={handleSubmit} className="mt-12 space-y-8">
              <Field id="project-name" label="Project Name">
                <input
                  id="project-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 42 Smith Street Apartments"
                  className={inputClass}
                />
              </Field>

              <div className="grid gap-8 sm:grid-cols-[2fr_1fr]">
                <Field id="site-address" label="Site Address">
                  <input
                    id="site-address"
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. 42 Smith Street, Collingwood VIC 3066"
                    className={inputClass}
                  />
                </Field>

                <Field id="site-postcode" label="Postcode">
                  <input
                    id="site-postcode"
                    type="text"
                    inputMode="numeric"
                    value={postcode}
                    onChange={(e) => setPostcode(e.target.value)}
                    placeholder="e.g. 3066"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field id="project-phase" label="Which phase is your project currently in?">
                <div role="radiogroup" aria-label="Project phase" className="flex flex-wrap gap-2">
                  {PHASES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={phase === p.value}
                      onClick={() => setPhase(p.value)}
                      className={`flex-1 basis-[calc(50%-0.5rem)] min-w-[240px] rounded-md border p-3 text-left transition-colors ${
                        phase === p.value
                          ? "border-ring bg-accent/50 ring-1 ring-ring/40"
                          : "border-input bg-background hover:border-ring/60 hover:bg-accent/30"
                      }`}
                    >
                      <span className="block text-sm font-medium text-foreground">
                        {p.value}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </Field>

              <div className="space-y-2">
                <span className="block text-sm font-medium text-foreground">
                  Planning documents (optional)
                </span>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    addFiles(e.dataTransfer.files);
                  }}
                  onClick={() => fileInputRef.current?.click()}
                  className={`cursor-pointer rounded-md border border-dashed px-6 py-10 text-center transition-colors ${
                    dragging ? "border-ring bg-accent/40" : "border-input bg-background"
                  }`}
                >
                  <p className="text-sm text-foreground">
                    Drag and drop files here, or click to browse
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF or image files
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED}
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </div>

                {files.length > 0 && (
                  <ul className="mt-3 divide-y divide-border rounded-md border border-border">
                    {files.map((file, i) => (
                      <li
                        key={`${file.name}-${i}`}
                        className="flex items-center justify-between gap-4 px-3 py-2"
                      >
                        <span className="truncate text-sm text-foreground">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <div className="flex justify-end pt-2">
                <button type="submit" disabled={submitting} className={buttonClass}>
                  {submitting ? "Saving…" : "Next"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

const inputClass =
  "block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/30";

const buttonClass =
  "inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
