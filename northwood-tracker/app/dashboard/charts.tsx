"use client";

import { useId, useState, type ReactNode } from "react";
import type { Bar, Slice } from "@/lib/dashboard";

// Chart colors, from the dataviz reference palette, validated on the white
// card surface (all checks pass; aqua is under 3:1, so slices carry visible
// labels and every chart has a table view).
const SERIES = ["#2a78d6", "#eb6834", "#1baf7a"];
const OTHER = "#898781"; // De-emphasis gray, for "Not set".
const SURFACE = "#ffffff";
const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";

const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";

export function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-secondary/20 bg-surface px-6 py-4">
      <p className={LABEL}>{label}</p>
      <p className="mt-1 font-display text-[2.5rem] leading-tight text-primary">
        {value}
      </p>
    </div>
  );
}

// Card with a title and a Chart/Table toggle (the table is the accessible
// twin of every chart).
export function ChartCard({
  title,
  subtitle,
  table,
  children,
}: {
  title: string;
  subtitle?: string;
  table: { headers: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <figure className="flex flex-col rounded-lg border border-secondary/20 bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <figcaption>
          <h2 className="font-display text-xl leading-tight text-primary">
            {title}
          </h2>
          {subtitle && <p className="text-sm text-secondary">{subtitle}</p>}
        </figcaption>
        <button
          type="button"
          onClick={() => setShowTable(!showTable)}
          aria-pressed={showTable}
          className="shrink-0 rounded-md border border-secondary/40 px-3 py-1 text-sm text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {showTable ? "Chart" : "Table"}
        </button>
      </div>
      <div className="mt-4 flex-1">
        {showTable ? (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={LABEL}>
                {table.headers.map((h, i) => (
                  <th key={h} className={`py-2 ${i > 0 ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row) => (
                <tr
                  key={String(row[0])}
                  className="border-t border-secondary/20"
                >
                  {row.map((cell, i) => (
                    <td
                      key={i}
                      className={`py-2 ${i > 0 ? "text-right tabular-nums" : ""}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          children
        )}
      </div>
    </figure>
  );
}

// Round the axis up to a clean number with about four ticks.
function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const PLOT_HEIGHT = 180; // px, plus the x-axis band below it.

// Vertical columns for one series. Only the tallest column is labeled; the
// axis, hover tooltip, and table view carry the rest.
export function ColumnChart({
  data,
  unit,
  color = SERIES[0],
  barWidth = 24,
  angledLabels = false,
}: {
  data: Bar[];
  // Singular and plural, e.g. ["student", "students"].
  unit: [string, string];
  // Color for every bar, unless a bar sets its own.
  color?: string;
  // Max column width in px.
  barWidth?: number;
  // Tilt x-axis labels so long names fit under narrow columns.
  angledLabels?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  const ticks = niceTicks(Math.max(...data.map((d) => d.value)));
  const top = ticks[ticks.length - 1];
  const maxValue = Math.max(...data.map((d) => d.value));
  const maxIndex = data.findIndex((d) => d.value === maxValue);
  const format = (v: number) => `${v} ${v === 1 ? unit[0] : unit[1]}`;

  return (
    <div className="flex gap-2">
      {/* Y axis */}
      <div
        className="relative w-8 shrink-0 text-right text-xs text-secondary tabular-nums"
        style={{ height: PLOT_HEIGHT }}
        aria-hidden="true"
      >
        {ticks.map((t) => (
          <span
            key={t}
            // Centered on its gridline.
            className="absolute right-0 translate-y-1/2"
            style={{ bottom: `${(t / top) * 100}%` }}
          >
            {t}
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1">
        {/* Plot */}
        <div className="relative" style={{ height: PLOT_HEIGHT }}>
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden="true"
              className="absolute inset-x-0 h-px"
              style={{
                bottom: `${(t / top) * 100}%`,
                backgroundColor: t === 0 ? BASELINE : GRID,
              }}
            />
          ))}
          <ul className="absolute inset-0 flex">
            {data.map((d, i) => {
              const height = (d.value / top) * 100;
              const showLabel = i === maxIndex && d.value > 0;
              return (
                <li
                  key={d.label}
                  // The whole column slot is the hit target, not just the bar.
                  tabIndex={0}
                  aria-label={`${d.label}: ${format(d.value)}`}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                  className="relative flex flex-1 cursor-default items-end justify-center rounded-sm outline-none focus-visible:bg-neutral"
                >
                  {d.value > 0 && (
                    <div
                      className="w-full rounded-t-[4px] transition-opacity"
                      style={{
                        height: `${height}%`,
                        maxWidth: barWidth,
                        backgroundColor: d.color ?? color,
                        // A white bar needs an edge to show on the card.
                        boxShadow:
                          d.color === SURFACE
                            ? `inset 0 0 0 1px ${BASELINE}`
                            : undefined,
                        opacity: active === null || active === i ? 1 : 0.55,
                      }}
                    />
                  )}
                  {showLabel && active !== i && (
                    <span
                      aria-hidden="true"
                      className="absolute text-sm text-primary"
                      style={{ bottom: `calc(${height}% + 2px)` }}
                    >
                      {d.value}
                    </span>
                  )}
                  {active === i && (
                    <Tooltip bottom={`calc(${height}% + 6px)`}>
                      <strong className="text-primary">
                        {format(d.value)}
                      </strong>
                      <span className="text-secondary">{d.label}</span>
                    </Tooltip>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
        {/* X axis */}
        <div
          className={`mt-1 flex ${angledLabels ? "h-14" : ""}`}
          aria-hidden="true"
        >
          {data.map((d) =>
            angledLabels ? (
              // Anchored at the column's center and tilted up to the left.
              <span key={d.label} className="relative flex-1">
                <span className="absolute right-1/2 top-0 origin-top-right -rotate-45 whitespace-nowrap text-xs text-secondary">
                  {d.label}
                </span>
              </span>
            ) : (
              <span
                key={d.label}
                className="flex-1 truncate text-center text-xs text-secondary"
                title={d.label}
              >
                {d.label}
              </span>
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Tooltip({
  bottom,
  children,
}: {
  bottom: string;
  children: ReactNode;
}) {
  return (
    <span
      role="presentation"
      className="pointer-events-none absolute z-10 flex flex-col items-center whitespace-nowrap rounded-md border border-secondary/20 bg-surface px-2 py-1 text-sm leading-tight shadow-sm"
      style={{ bottom }}
    >
      {children}
    </span>
  );
}

// Pie for a few parts of one whole. Colors follow the entity (fixed order),
// slices are separated by a 2px surface gap, and each slice large enough
// shows its share inside.
export function PieChart({ data }: { data: Slice[] }) {
  const [active, setActive] = useState<number | null>(null);
  const titleId = useId();
  const total = data.reduce((n, d) => n + d.value, 0);
  const R = 90;
  const C = 100;
  const colorOf = (i: number) =>
    data[i].label === "Not set" ? OTHER : SERIES[i % SERIES.length];
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);

  // Each slice starts where the ones before it end, from 12 o'clock.
  const sweepOf = (v: number) => (total ? (v / total) * Math.PI * 2 : 0);
  const slices = data.map((d, i) => {
    const start =
      -Math.PI / 2 +
      data.slice(0, i).reduce((sum, prev) => sum + sweepOf(prev.value), 0);
    const sweep = sweepOf(d.value);
    return { ...d, i, start, end: start + sweep, sweep };
  });

  const point = (a: number, r: number) =>
    `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`;

  return (
    <div className="flex h-full flex-wrap items-center justify-center gap-6">
      <div className="relative">
        <svg
          viewBox="0 0 200 200"
          className="size-40"
          role="img"
          aria-labelledby={titleId}
        >
          <title id={titleId}>
            {data.map((d) => `${d.label}: ${d.value}`).join(", ")}
          </title>
          {total === 0 && <circle cx={C} cy={C} r={R} fill={GRID} />}
          {slices.map((s) =>
            s.value === 0 ? null : (
              <g
                key={s.label}
                tabIndex={0}
                aria-label={`${s.label}: ${s.value} (${pct(s.value)}%)`}
                onPointerEnter={() => setActive(s.i)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(s.i)}
                onBlur={() => setActive(null)}
                className="outline-none"
              >
                {s.sweep >= Math.PI * 2 - 1e-6 ? (
                  <circle cx={C} cy={C} r={R} fill={colorOf(s.i)} />
                ) : (
                  <path
                    d={`M ${C} ${C} L ${point(s.start, R)} A ${R} ${R} 0 ${
                      s.sweep > Math.PI ? 1 : 0
                    } 1 ${point(s.end, R)} Z`}
                    fill={colorOf(s.i)}
                    // The 2px gap between slices, in the surface color.
                    stroke={SURFACE}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    opacity={active === null || active === s.i ? 1 : 0.55}
                  />
                )}
                {/* Share inside the slice, only where it fits. */}
                {s.sweep > 0.5 && (
                  <text
                    x={C + R * 0.6 * Math.cos((s.start + s.end) / 2)}
                    y={C + R * 0.6 * Math.sin((s.start + s.end) / 2)}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    className="pointer-events-none text-[18px]"
                  >
                    {pct(s.value)}%
                  </text>
                )}
              </g>
            ),
          )}
        </svg>
        {active !== null && (
          <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 flex -translate-x-1/2 flex-col items-center whitespace-nowrap rounded-md border border-secondary/20 bg-surface px-2 py-1 text-sm leading-tight shadow-sm">
            <strong className="text-primary">
              {data[active].value} ({pct(data[active].value)}%)
            </strong>
            <span className="text-secondary">{data[active].label}</span>
          </span>
        )}
      </div>

      {/* Legend: a swatch beside text; text never wears the series color. */}
      <ul className="flex flex-col gap-2">
        {data.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-[2px]"
              style={{ backgroundColor: colorOf(i) }}
            />
            <span className="whitespace-nowrap text-primary">{d.label}</span>
            <span className="text-sm text-secondary">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
