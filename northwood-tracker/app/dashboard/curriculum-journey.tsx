"use client";

import Image from "next/image";
import { useState } from "react";
import { capitalize, type BeltInfo } from "@/lib/belts";
import type { Activity, CurriculumBelt } from "@/lib/students";

const TYPE_LABELS: Record<string, string> = {
  build: "Build",
  quest: "Quest",
  adventure: "Adventure",
  prove: "Prove Yourself",
  mastery: "Mastery",
};

// Level bubbles: up to this many per branch, then a new branch below.
const LEVELS_PER_ROW = 9;
// Sizes (rem) the branch lines are drawn from: bubble width, gap between
// bubbles, stem above each bubble, and gap between rows.
const BUBBLE = 3.5;
const GAP = 0.75;
const STEM = 1;
const ROW_GAP = 1;

const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";

// The belt journey: belt icons along a timeline. Clicking a belt pops a
// bubble with its levels branching off; clicking a level shows its
// activities.
export function CurriculumJourney({
  belts,
  beltInfo,
}: {
  belts: CurriculumBelt[];
  // Belt colors, from the `belts` collection.
  beltInfo: BeltInfo[];
}) {
  const [openBelt, setOpenBelt] = useState<number | null>(null);
  const [openLevel, setOpenLevel] = useState<number | null>(null);

  if (belts.length === 0) {
    return (
      <p className="mt-6 text-secondary">
        No curriculum yet. Load rsrc/curriculum.md into the database.
      </p>
    );
  }

  const index = belts.findIndex((b) => b.belt_id === openBelt);
  const belt = index >= 0 ? belts[index] : null;
  const level = belt?.levels.find((l) => l.belt_level === openLevel) ?? null;
  // Centers of the evenly spaced belt columns, as % of the timeline width.
  const center = (i: number) => ((i + 0.5) / belts.length) * 100;

  function toggleBelt(id: number) {
    setOpenBelt(openBelt === id ? null : id);
    setOpenLevel(null);
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-lg border border-secondary/20 bg-surface px-6 pb-6 pt-8">
      <div className="min-w-[52rem]">
        {/* Timeline */}
        <ol
          className="relative grid"
          style={{
            gridTemplateColumns: `repeat(${belts.length}, minmax(0, 1fr))`,
          }}
        >
          <span
            aria-hidden="true"
            className="absolute top-7 h-0.5 bg-secondary/30"
            style={{ left: `${center(0)}%`, right: `${center(0)}%` }}
          />
          {belts.map((b) => {
            const open = b.belt_id === openBelt;
            return (
              <li key={b.belt_id} className="relative flex justify-center">
                <button
                  type="button"
                  onClick={() => toggleBelt(b.belt_id)}
                  aria-expanded={open}
                  aria-controls="curriculum-bubble"
                  className="group flex flex-col items-center gap-1 rounded-md px-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span
                    className={`rounded-full bg-surface transition-transform group-hover:scale-110 ${
                      open ? "scale-110 ring-2 ring-primary ring-offset-2" : ""
                    }`}
                  >
                    <Image
                      src={`/icons/${b.belt_title}.svg`}
                      alt=""
                      width={56}
                      height={56}
                      className="size-14"
                    />
                  </span>
                  <span className={`text-sm ${open ? "text-primary" : ""}`}>
                    {capitalize(b.belt_title)}
                  </span>
                  <span className="text-xs text-secondary">
                    {b.levels.length}{" "}
                    {b.levels.length === 1 ? "level" : "levels"}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        {/* Bubble for the open belt */}
        {belt && (
          <div
            id="curriculum-bubble"
            key={belt.belt_id}
            className="animate-bubble-pop relative mt-5 rounded-2xl border border-secondary/30 bg-surface p-6"
            style={{ transformOrigin: `${center(index)}% 0` }}
          >
            {/* Pointer up to the belt's icon */}
            <span
              aria-hidden="true"
              className="absolute -top-[0.5625rem] size-4 -translate-x-1/2 rotate-45 border-l border-t border-secondary/30 bg-surface"
              style={{ left: `${center(index)}%` }}
            />
            <h2 className="font-display text-xl leading-tight">
              {capitalize(belt.belt_title)} Belt
              <span className="ml-2 text-sm text-secondary">
                {belt.levels.length}{" "}
                {belt.levels.length === 1 ? "level" : "levels"} · choose a level
              </span>
            </h2>
            <LevelTree
              belt={belt}
              color={
                beltInfo.find((b) => b.belt_id === belt.belt_id)?.color ??
                "#6c7278"
              }
              openLevel={openLevel}
              onToggle={(l) => setOpenLevel(openLevel === l ? null : l)}
            />
            {level && (
              <Activities
                belt={belt}
                level={level.belt_level}
                activities={level.activities}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Level bubbles hanging off branches: a spine down the left, one branch per
// row, and a stem up from each bubble to its branch.
function LevelTree({
  belt,
  color,
  openLevel,
  onToggle,
}: {
  belt: CurriculumBelt;
  color: string;
  openLevel: number | null;
  onToggle: (level: number) => void;
}) {
  const rows: CurriculumBelt["levels"][] = [];
  for (let i = 0; i < belt.levels.length; i += LEVELS_PER_ROW) {
    rows.push(belt.levels.slice(i, i + LEVELS_PER_ROW));
  }
  const text = isLight(color) ? "#1a1c1e" : "#ffffff";
  const rowHeight = STEM + BUBBLE;
  const line = "bg-secondary/40";

  return (
    <div className="relative mt-4" style={{ paddingLeft: `${BUBBLE / 2}rem` }}>
      {/* Spine from the heading down to the last branch */}
      <span
        aria-hidden="true"
        className={`absolute top-0 w-px ${line}`}
        style={{
          left: `${BUBBLE / 2}rem`,
          height: `${(rows.length - 1) * (rowHeight + ROW_GAP)}rem`,
        }}
      />
      <div className="flex flex-col" style={{ gap: `${ROW_GAP}rem` }}>
        {rows.map((row, r) => (
          <ol
            key={r}
            className="relative flex"
            style={{ gap: `${GAP}rem`, paddingLeft: `${GAP}rem` }}
          >
            {/* Branch along the top of the row */}
            <span
              aria-hidden="true"
              className={`absolute top-0 h-px ${line}`}
              style={{
                left: 0,
                width: `${GAP + (row.length - 1) * (BUBBLE + GAP) + BUBBLE / 2}rem`,
              }}
            />
            {row.map(({ belt_level }) => {
              const open = belt_level === openLevel;
              return (
                <li key={belt_level} className="flex flex-col items-center">
                  <span
                    aria-hidden="true"
                    className={`w-px ${line}`}
                    style={{ height: `${STEM}rem` }}
                  />
                  <button
                    type="button"
                    onClick={() => onToggle(belt_level)}
                    aria-expanded={open}
                    aria-label={`${capitalize(belt.belt_title)} level ${belt_level}`}
                    className={`flex items-center justify-center rounded-full font-display text-lg transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                      open ? "scale-110 ring-2 ring-primary ring-offset-2" : ""
                    }`}
                    style={{
                      width: `${BUBBLE}rem`,
                      height: `${BUBBLE}rem`,
                      backgroundColor: color,
                      color: text,
                      // White belt needs an edge to show on the card.
                      boxShadow:
                        color.toLowerCase() === "#ffffff"
                          ? "inset 0 0 0 1px #c3c2b7"
                          : undefined,
                    }}
                  >
                    {belt_level}
                  </button>
                </li>
              );
            })}
          </ol>
        ))}
      </div>
    </div>
  );
}

function Activities({
  belt,
  level,
  activities,
}: {
  belt: CurriculumBelt;
  level: number;
  activities: Activity[];
}) {
  return (
    <section
      key={level}
      className="animate-bubble-pop mt-6 border-t border-secondary/20 pt-4"
    >
      <h3 className="font-display text-lg leading-tight">
        {capitalize(belt.belt_title)} · Level {level}
        <span className="ml-2 text-sm text-secondary">
          {activities.length}{" "}
          {activities.length === 1 ? "activity" : "activities"}
        </span>
      </h3>
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {activities.map((a, i) => (
          <li
            key={a.activity_id ?? i}
            className="flex items-baseline gap-3 rounded-md border border-secondary/20 px-3 py-2"
          >
            <span className="text-sm text-secondary tabular-nums">
              {i + 1}.
            </span>
            <span className="min-w-0">
              <span className={`block ${LABEL}`}>
                {TYPE_LABELS[a.type ?? ""] ?? a.type ?? "Activity"}
              </span>
              <span>{a.title}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// Whether a hex color is light enough to need dark text on it.
function isLight(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4;
}
