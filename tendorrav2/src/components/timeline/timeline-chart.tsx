"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  MILESTONE_STYLES,
  categoryColor,
  categoryLabel,
  type TimelineItem,
} from "@/lib/timeline";
import { MONTHS_SHORT, formatDate } from "@/lib/format";

const DAY = 86_400_000;
const LABEL_W = 170;
const LANE_H = 38;
const AXIS_GAP = 26;
const EVENT_ROW_H = 14;

type Placed = { item: TimelineItem; x: number; lane: number };

/** Greedy lane packing so milestone labels never overlap. */
function packLanes(points: { item: TimelineItem; x: number }[], minGap: number) {
  const laneEnds: number[] = [];
  return points.map(({ item, x }) => {
    let lane = laneEnds.findIndex((end) => x - end >= minGap);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(x);
    } else {
      laneEnds[lane] = x;
    }
    return { item, x, lane };
  });
}

export function TimelineChart({
  items,
  startDate,
  targetDate,
  onSelect,
}: {
  items: TimelineItem[];
  startDate?: string | null;
  targetDate?: string | null;
  onSelect?: (id: string) => void;
}) {
  const [hover, setHover] = useState<{ item: TimelineItem; x: number; y: number } | null>(null);
  // Layout depends on the current time ("Today" marker), so only draw it in the browser.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scroller = useRef<HTMLDivElement>(null);

  const layout = useMemo(() => {
    const times = items.map((i) => new Date(i.occurred_at).getTime());
    if (startDate) times.push(new Date(startDate).getTime());
    if (targetDate) times.push(new Date(targetDate).getTime());
    if (times.length === 0) return null;

    let min = Math.min(...times);
    let max = Math.max(...times);
    const span = Math.max(max - min, 30 * DAY);
    min -= span * 0.04;
    max = min + span * 1.08;

    const months = span / (30 * DAY);
    const width = Math.max(900, Math.min(4000, Math.round(months * 90)));
    const pad = 40;
    const xOf = (t: number) => pad + ((t - min) / (max - min)) * (width - pad * 2);

    const sorted = [...items].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
    const milestones: Placed[] = packLanes(
      sorted.filter((i) => i.kind === "milestone").map((item) => ({ item, x: xOf(new Date(item.occurred_at).getTime()) })),
      LABEL_W + 8,
    );
    const events: Placed[] = packLanes(
      sorted.filter((i) => i.kind === "event").map((item) => ({ item, x: xOf(new Date(item.occurred_at).getTime()) })),
      12,
    );

    const milestoneLanes = Math.max(1, ...milestones.map((m) => m.lane + 1));
    const eventLanes = Math.max(1, ...events.map((e) => e.lane + 1));
    const axisY = 20 + milestoneLanes * LANE_H + AXIS_GAP;
    const height = axisY + 34 + eventLanes * EVENT_ROW_H + 12;

    // Month ticks (every month, or every quarter on long projects)
    const ticks: { x: number; label: string; major: boolean }[] = [];
    const step = months > 36 ? 3 : 1;
    const d = new Date(min);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + 1);
    while (d.getTime() < max) {
      if (d.getMonth() % step === 0) {
        const major = d.getMonth() === 0;
        ticks.push({
          x: xOf(d.getTime()),
          label: major ? String(d.getFullYear()) : MONTHS_SHORT[d.getMonth()],
          major,
        });
      }
      d.setMonth(d.getMonth() + 1);
    }

    const now = Date.now();
    const todayX = now >= min && now <= max ? xOf(now) : null;
    const startX = startDate ? xOf(new Date(startDate).getTime()) : null;
    const targetX = targetDate ? xOf(new Date(targetDate).getTime()) : null;

    return { width, height, axisY, milestones, events, ticks, todayX, startX, targetX };
  }, [items, startDate, targetDate]);

  // Open long timelines scrolled so "today" is in view.
  const todayX = layout?.todayX ?? null;
  useEffect(() => {
    const el = scroller.current;
    if (mounted && el && todayX !== null && el.scrollWidth > el.clientWidth) {
      el.scrollLeft = Math.max(0, todayX - el.clientWidth * 0.6);
    }
  }, [mounted, todayX]);

  if (!mounted && items.length) {
    return <div className="h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />;
  }

  if (!layout) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-500">
        The timeline appears here once you add emails or entries.
      </div>
    );
  }

  const { width, height, axisY } = layout;
  const usedCategories = CATEGORIES.filter((c) => items.some((i) => i.kind === "event" && (i.category ?? "other") === c));

  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <svg width={width} height={height} className="block" role="img" aria-label="Project timeline">
          {/* month grid */}
          {layout.ticks.map((t) => (
            <g key={`${t.x}-${t.label}`}>
              <line x1={t.x} x2={t.x} y1={10} y2={height - 6} stroke={t.major ? "#cbd5e1" : "#f1f5f9"} />
              <text x={t.x + 4} y={axisY + 18} fontSize={11} fill={t.major ? "#334155" : "#94a3b8"} fontWeight={t.major ? 600 : 400}>
                {t.label}
              </text>
            </g>
          ))}

          {/* project window */}
          {layout.startX !== null && layout.targetX !== null && (
            <rect x={layout.startX} y={axisY - 3} width={Math.max(0, layout.targetX - layout.startX)} height={6} rx={3} fill="#dbeafe" />
          )}
          <line x1={20} x2={width - 20} y1={axisY} y2={axisY} stroke="#94a3b8" strokeWidth={1.5} />
          {layout.startX !== null && (
            <text x={layout.startX} y={axisY - 8} fontSize={10} fill="#64748b" textAnchor="middle">Start</text>
          )}
          {layout.targetX !== null && (
            <g>
              <line x1={layout.targetX} x2={layout.targetX} y1={axisY - 10} y2={axisY + 10} stroke="#1f57d6" strokeWidth={2} />
              <text x={layout.targetX} y={axisY - 13} fontSize={10} fill="#1f57d6" textAnchor="middle" fontWeight={600}>Target</text>
            </g>
          )}
          {layout.todayX !== null && (
            <g>
              <line x1={layout.todayX} x2={layout.todayX} y1={8} y2={height - 6} stroke="#ef4444" strokeDasharray="4 3" />
              <text x={layout.todayX + 4} y={16} fontSize={10} fill="#ef4444" fontWeight={600}>Today</text>
            </g>
          )}

          {/* milestones above the axis */}
          {layout.milestones.map(({ item, x, lane }) => {
            const style = MILESTONE_STYLES[item.milestone_status ?? "planned"];
            const labelY = axisY - AXIS_GAP - lane * LANE_H;
            return (
              <g
                key={item.id}
                className="cursor-pointer"
                onClick={() => onSelect?.(item.id)}
                onMouseEnter={() => setHover({ item, x, y: labelY - 20 })}
                onMouseLeave={() => setHover(null)}
              >
                <line x1={x} x2={x} y1={labelY + 4} y2={axisY - 8} stroke={style.stroke} strokeOpacity={0.4} />
                <rect
                  x={x - 7}
                  y={axisY - 7}
                  width={14}
                  height={14}
                  transform={`rotate(45 ${x} ${axisY})`}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={2}
                />
                <foreignObject x={x - 6} y={labelY - 26} width={LABEL_W} height={32}>
                  <div className="truncate text-[11px] leading-tight">
                    <div className="truncate font-semibold text-slate-800">{item.title}</div>
                    <div className="text-slate-500">{formatDate(item.occurred_at)}</div>
                  </div>
                </foreignObject>
              </g>
            );
          })}

          {/* events below the axis */}
          {layout.events.map(({ item, x, lane }) => (
            <circle
              key={item.id}
              cx={x}
              cy={axisY + 34 + lane * EVENT_ROW_H}
              r={5}
              fill={categoryColor(item.category)}
              stroke="#fff"
              strokeWidth={1.5}
              className="cursor-pointer"
              onClick={() => onSelect?.(item.id)}
              onMouseEnter={() => setHover({ item, x, y: axisY + 34 + lane * EVENT_ROW_H })}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 w-72 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg"
          style={{
            left: Math.min(
              Math.max(hover.x - (scroller.current?.scrollLeft ?? 0), 150),
              (scroller.current?.clientWidth ?? width) - 150,
            ),
            top: hover.y - 6,
          }}
        >
          <div className="font-semibold">{hover.item.title}</div>
          <div className="mt-0.5 text-slate-300">
            {formatDate(hover.item.occurred_at)} ·{" "}
            {hover.item.kind === "milestone"
              ? `Milestone (${MILESTONE_STYLES[hover.item.milestone_status ?? "planned"].label})`
              : categoryLabel(hover.item.category)}
          </div>
          {hover.item.summary && <div className="mt-1 line-clamp-3 text-slate-200">{hover.item.summary}</div>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
        {(["achieved", "planned", "missed"] as const).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rotate-45"
              style={{ background: MILESTONE_STYLES[s].fill, border: `2px solid ${MILESTONE_STYLES[s].stroke}` }}
            />
            {MILESTONE_STYLES[s].label} milestone
          </span>
        ))}
        {usedCategories.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: categoryColor(c) }} />
            {CATEGORY_LABELS[c]}
          </span>
        ))}
      </div>
    </div>
  );
}
