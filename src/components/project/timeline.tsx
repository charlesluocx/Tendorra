import { format, isFuture } from "date-fns";
import { cn } from "@/lib/utils";

export type TimelineEvent = {
  id: string;
  date: string;
  kind: "email" | "call_note" | "manual" | "milestone_done" | "milestone_upcoming";
  title: string;
  subtitle?: string;
};

const KIND_LABEL: Record<TimelineEvent["kind"], string> = {
  email: "Email",
  call_note: "Call",
  manual: "Update",
  milestone_done: "Milestone reached",
  milestone_upcoming: "Milestone expected",
};

function EventDot({ kind }: { kind: TimelineEvent["kind"] }) {
  if (kind === "milestone_done") {
    return <span className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-background bg-primary" />;
  }
  if (kind === "milestone_upcoming") {
    return (
      <span className="absolute left-0 top-1 h-3 w-3 rounded-full border-2 border-primary bg-background" />
    );
  }
  return (
    <span className="absolute left-[3px] top-[7px] h-2 w-2 rounded-full bg-muted-foreground/60" />
  );
}

export function ProjectTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nothing on the timeline yet.</p>;
  }

  const sorted = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <ol className="relative border-l border-border pl-6">
      {sorted.map((event) => {
        const future = isFuture(new Date(event.date));
        const isMilestone = event.kind === "milestone_done" || event.kind === "milestone_upcoming";
        return (
          <li key={event.id} className="relative pb-6 last:pb-0">
            <EventDot kind={event.kind} />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span
                className={cn(
                  "text-xs font-semibold uppercase tracking-wide",
                  isMilestone ? "text-primary" : "text-muted-foreground",
                )}
              >
                {KIND_LABEL[event.kind]}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(event.date), "d MMM yyyy")}
                {future ? " (expected)" : ""}
              </span>
            </div>
            <p className={cn("mt-1 text-sm", isMilestone ? "font-medium text-foreground" : "text-foreground")}>
              {event.title}
            </p>
            {event.subtitle && <p className="text-xs text-muted-foreground">{event.subtitle}</p>}
          </li>
        );
      })}
    </ol>
  );
}
