"use client";

import Image from "next/image";
import { useState } from "react";
import { capitalize, type BeltInfo } from "@/lib/belts";
import type { GuideBelt, GuideLevel } from "@/lib/debrief-guide";
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

// What each activity type is, for the Debrief Helper.
const TYPE_MEANINGS: Record<string, string> = {
  build:
    "A guided project: the ninja follows step-by-step instructions to make a game.",
  quest:
    "A challenge: the ninja uses what they learned in the level's builds, with less guidance.",
  adventure:
    "The level's wrap-up project: the ninja puts the level's concepts to use in their own creation.",
  prove:
    "A challenge after the build: the ninja changes or extends what they just built on their own.",
  mastery:
    "The belt's final, independent project, showing what the ninja learned across the belt.",
};

// The belt journey: belt icons along a timeline. Clicking a belt pops a
// bubble with its levels branching off; clicking a level shows its
// activities. With a `guide` (the Debrief Helper), the bubble also says
// what the belt teaches and each level's concepts, and activities can be
// clicked for their talking points.
export function CurriculumJourney({
  belts,
  beltInfo,
  guide,
}: {
  belts: CurriculumBelt[];
  // Belt colors, from the `belts` collection.
  beltInfo: BeltInfo[];
  // From content/debrief-help.md, matched to belts by belt_id.
  guide?: GuideBelt[];
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
  const beltGuide = guide?.find((g) => g.belt_id === belt?.belt_id);
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
              {beltGuide?.subtitle && (
                <span className="text-secondary"> · {beltGuide.subtitle}</span>
              )}
              <span className="ml-2 text-sm text-secondary">
                {belt.levels.length}{" "}
                {belt.levels.length === 1 ? "level" : "levels"} · choose a level
              </span>
            </h2>
            {beltGuide?.summary && (
              <p className="mt-2 max-w-3xl">
                <Markdown text={beltGuide.summary} />
              </p>
            )}
            <LevelTree
              belt={belt}
              color={
                beltInfo.find((b) => b.belt_id === belt.belt_id)?.color ??
                "#6c7278"
              }
              openLevel={openLevel}
              onToggle={(l) => setOpenLevel(openLevel === l ? null : l)}
            />
            {level ? (
              <Activities
                belt={belt}
                level={level.belt_level}
                activities={level.activities}
                guide={
                  guide
                    ? (beltGuide?.levels.find(
                        (l) => l.level === level.belt_level,
                      ) ?? null)
                    : undefined
                }
              />
            ) : (
              beltGuide && (
                <ConceptsByLevel
                  levels={beltGuide.levels}
                  onOpen={(l) => setOpenLevel(l)}
                />
              )
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
  guide,
}: {
  belt: CurriculumBelt;
  level: number;
  activities: Activity[];
  // Debrief Helper only: activities become buttons showing these concepts.
  guide?: GuideLevel | null;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const clickable = guide !== undefined;
  const activity = open !== null ? activities[open] : null;
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
      {guide && (
        <p className="text-sm text-secondary">
          <Markdown text={guide.label} />
          {clickable && " · choose an activity"}
        </p>
      )}
      <ol className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {activities.map((a, i) => {
          const content = (
            <>
              <span className="text-sm text-secondary tabular-nums">
                {i + 1}.
              </span>
              <span className="min-w-0">
                <span className={`block ${LABEL}`}>{typeLabel(a)}</span>
                <span>{a.title}</span>
              </span>
            </>
          );
          return (
            <li key={a.activity_id ?? i}>
              {clickable ? (
                <button
                  type="button"
                  onClick={() => setOpen(open === i ? null : i)}
                  aria-expanded={open === i}
                  aria-controls="activity-detail"
                  className={`flex h-full w-full items-baseline gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    open === i
                      ? "border-primary bg-neutral"
                      : "border-secondary/20"
                  }`}
                >
                  {content}
                </button>
              ) : (
                <div className="flex h-full items-baseline gap-3 rounded-md border border-secondary/20 px-3 py-2">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {clickable && activity && (
        <div
          id="activity-detail"
          key={open}
          className="animate-bubble-pop mt-4 rounded-lg border border-secondary/30 bg-neutral/60 p-4"
        >
          <p className={LABEL}>{typeLabel(activity)}</p>
          <h4 className="font-display text-lg leading-tight">
            {activity.title}
          </h4>
          {TYPE_MEANINGS[activity.type ?? ""] && (
            <p className="mt-1 text-sm text-secondary">
              {TYPE_MEANINGS[activity.type ?? ""]}
            </p>
          )}
          {guide ? (
            <>
              <p className={`mt-3 ${LABEL}`}>
                What they practice · <Markdown text={guide.label} />
              </p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {guide.concepts.map((c, i) => (
                  <li key={i}>
                    <Markdown text={c} />
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-3 text-sm text-secondary">
              No talking points for this level in content/debrief-help.md.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function typeLabel(a: Activity) {
  return TYPE_LABELS[a.type ?? ""] ?? a.type ?? "Activity";
}

// Every level's focus and concepts, shown under a belt until a level is
// picked. Clicking a level's name opens it.
function ConceptsByLevel({
  levels,
  onOpen,
}: {
  levels: GuideLevel[];
  onOpen: (level: number) => void;
}) {
  return (
    <section className="mt-6 border-t border-secondary/20 pt-4">
      <h3 className="font-display text-lg leading-tight">Concepts by level</h3>
      <ol className="mt-3 grid gap-4 lg:grid-cols-2">
        {levels.map((l) => (
          <li key={l.level}>
            <button
              type="button"
              onClick={() => onOpen(l.level)}
              className="text-left font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Level {l.level} · <Markdown text={l.label} />
            </button>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
              {l.concepts.map((c, i) => (
                <li key={i}>
                  <Markdown text={c} />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </section>
  );
}

// The inline markdown in content/debrief-help.md: **bold**, *italic*, and
// `code`. Everything else is plain text.
export function Markdown({ text }: { text: string }) {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/)
    .map((part, i) =>
      part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
        <strong key={i} className="font-semibold">
          <Markdown text={part.slice(2, -2)} />
        </strong>
      ) : part.startsWith("`") && part.endsWith("`") && part.length > 2 ? (
        <code
          key={i}
          className="rounded bg-neutral px-1 py-0.5 font-mono text-[0.85em]"
        >
          {part.slice(1, -1)}
        </code>
      ) : part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
        <em key={i}>
          <Markdown text={part.slice(1, -1)} />
        </em>
      ) : (
        part
      ),
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
