export type FormState = { error?: string; success?: string } | undefined;

export function FormMessage({ state }: { state: FormState }) {
  if (!state) return null;
  if (state.error)
    return <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  if (state.success)
    return (
      <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
        {state.success}
      </p>
    );
  return null;
}
