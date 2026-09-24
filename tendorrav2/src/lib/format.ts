/**
 * Deterministic date formatting: the same output on the server and in every
 * browser (avoids hydration mismatches and off-by-one-day bugs), always shown
 * in the company's timezone.
 */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || "Australia/Sydney";

export const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** Calendar parts of a timestamp in the app timezone. month is 0-based. */
export function zonedParts(value: string | number | Date) {
  const d = value instanceof Date ? value : new Date(value);
  const get = (type: string) => Number(partsFormatter.formatToParts(d).find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month") - 1, day: get("day"), hour: get("hour"), minute: get("minute") };
}

function valid(value: string | null | undefined): value is string {
  return Boolean(value) && !Number.isNaN(new Date(value as string).getTime());
}

/** Date-only columns (YYYY-MM-DD) are calendar dates, not instants: never shift them by timezone. */
function isDateOnly(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function formatDate(value: string | null | undefined) {
  if (!valid(value)) return "—";
  if (isDateOnly(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return `${d} ${MONTHS_SHORT[m - 1]} ${y}`;
  }
  const p = zonedParts(value);
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!valid(value)) return "—";
  const p = zonedParts(value);
  const h12 = p.hour % 12 || 12;
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}, ${h12}:${String(p.minute).padStart(2, "0")} ${p.hour < 12 ? "am" : "pm"}`;
}

export function formatMonthYear(value: string) {
  const p = zonedParts(value);
  return `${MONTHS_LONG[p.month]} ${p.year}`;
}

export function formatBytes(n: number | null | undefined) {
  if (n == null) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
