"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  activityLabel,
  activityValue,
  noActivityLabel,
  beltHasType,
  BELT_TYPES,
  capitalize,
  nextBelt,
  pathKey,
  sameActivity,
  type BeltInfo,
  type BeltPaths,
} from "@/lib/belts";
import { TagChips } from "@/components/tag-chips";
import { useToast } from "@/components/toast";
import type { Activity, Belt, SessionNote, Student } from "@/lib/students";
import {
  beltUp,
  changeActivity,
  levelUp,
  saveNotes,
  type ProgressResult,
} from "./actions";
import { BeltBadge } from "./belt-badge";
import { Confetti } from "./confetti";

const NOTE_FIELDS = [
  { key: "working_on", label: "What are they working on?" },
  { key: "accomplished", label: "What did they accomplish today?" },
  { key: "next_steps", label: "What will they work on next time?" },
] as const;

type NoteKey = (typeof NOTE_FIELDS)[number]["key"];
type Notes = Record<NoteKey, string>;

const LEVEL_UP = "level-up";
const BELT_UP = "belt-up";
// Notes save this long after typing stops (one small request per pause, so
// it stays light on the Pi).
const AUTOSAVE_MS = 3000;

type SaveStatus = "saved" | "unsaved" | "saving" | "error";
type Conflicts = Partial<Record<NoteKey, { theirs: string; by?: string }>>;

// What the board can do with a card: save it, and pass it live updates.
export type CardHandle = {
  flush: () => Promise<boolean>;
  receive: (
    note: SessionNote | undefined,
    student: Student | undefined,
  ) => void;
};

export function StudentCard({
  student,
  paths,
  belts,
  note,
  debriefed,
  onDebriefedChange,
  birthday,
  onUnsavedChange,
  register,
}: {
  student: Student;
  paths: BeltPaths;
  belts: BeltInfo[];
  // Today's saved note, if there is one.
  note?: SessionNote;
  debriefed: boolean;
  // Today is their birthday: confetti and a party hat.
  birthday: boolean;
  // Reports whether the note text has unsaved changes.
  onUnsavedChange: (unsaved: boolean) => void;
  onDebriefedChange: (debriefed: boolean) => void;
  // Gives the board this card's save (for Save Day) and live-update hooks.
  register: (handle: CardHandle | null) => void;
}) {
  const toast = useToast();
  // Already debriefed when the page loads: start minimized.
  const [minimized, setMinimized] = useState(debriefed);
  const [belt, setBelt] = useState(student.belt);
  const [activity, setActivity] = useState(student.current_activity);
  const [busy, setBusy] = useState(false);
  // A level or belt up waiting for "Confirm": its option value and the
  // question to ask.
  const [pendingProgress, setPendingProgress] = useState<{
    value: string;
    question: string;
  } | null>(null);
  const [notes, setNotes] = useState<Notes>({
    working_on: note?.working_on ?? "",
    accomplished: note?.accomplished ?? "",
    next_steps: note?.next_steps ?? "",
  });
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<SaveStatus>("saved");
  // Fields someone else changed while this sensei was editing them.
  const [conflicts, setConflicts] = useState<Conflicts>({});
  // Fields changed since they were last saved, the latest note text, and
  // each field's last-known saved value (what a save expects to replace).
  // Read by the save function without re-creating it on every keystroke.
  const dirty = useRef(new Set<NoteKey>());
  const latest = useRef(notes);
  const base = useRef<Notes>({ ...notes });
  useEffect(() => {
    latest.current = notes;
  }, [notes]);

  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Live updates, called by the board when a poll brings new data: fields
  // this sensei isn't editing take the saved value; fields they are editing
  // get a "use theirs / keep mine" choice instead. Belt and activity are
  // last-change-wins.
  const receive = useCallback(
    (
      serverNote: SessionNote | undefined,
      serverStudent: Student | undefined,
    ) => {
      if (serverNote) {
        const incoming: Partial<Notes> = {};
        const clashes: Conflicts = {};
        for (const { key } of NOTE_FIELDS) {
          const server = serverNote[key] ?? "";
          if (server === base.current[key]) continue;
          if (dirty.current.has(key)) {
            clashes[key] = { theirs: server, by: serverNote.edited_by };
          } else {
            base.current[key] = server;
            incoming[key] = server;
          }
        }
        if (Object.keys(incoming).length) {
          latest.current = { ...latest.current, ...incoming };
          setNotes((n) => ({ ...n, ...incoming }));
        }
        if (Object.keys(clashes).length) {
          setConflicts((c) => ({ ...c, ...clashes }));
        }
      }
      if (serverStudent && !busyRef.current) {
        setBelt((b) =>
          JSON.stringify(b) === JSON.stringify(serverStudent.belt)
            ? b
            : serverStudent.belt,
        );
        setActivity((a) =>
          JSON.stringify(a ?? null) ===
          JSON.stringify(serverStudent.current_activity ?? null)
            ? a
            : serverStudent.current_activity,
        );
      }
    },
    [],
  );

  useEffect(() => {
    onUnsavedChange(status !== "saved");
  }, [status, onUnsavedChange]);

  const name = `${student.first_name} ${student.last_name}`;
  // Based on today's belt, so a Junior who belts up keeps the JR card until
  // their next session.
  const isJunior = student.belt.belt_id === 0;
  // JR cards don't track what was accomplished.
  const noteFields = isJunior
    ? NOTE_FIELDS.filter(({ key }) => key !== "accomplished")
    : NOTE_FIELDS;
  const activities = paths[pathKey(belt)] ?? [];

  // Saves changed note fields. Fields edited again while saving stay dirty.
  const flush = useCallback(async (): Promise<boolean> => {
    if (dirty.current.size === 0) return true;
    const sent: Partial<Notes> = {};
    const bases: Partial<Notes> = {};
    for (const key of dirty.current) {
      sent[key] = latest.current[key];
      bases[key] = base.current[key];
    }
    setStatus("saving");
    const result = await saveNotes(student.id, sent, bases).catch(() => null);
    if (!result?.ok) {
      if (result && "conflict" in result) {
        const clashes: Conflicts = {};
        for (const key of Object.keys(sent) as NoteKey[]) {
          const theirs = result.current[key] ?? "";
          if (theirs !== base.current[key]) {
            clashes[key] = { theirs, by: result.edited_by };
          }
        }
        setConflicts((c) => ({ ...c, ...clashes }));
      }
      setStatus("error");
      return false;
    }
    for (const key of Object.keys(sent) as NoteKey[]) {
      base.current[key] = sent[key]!;
      if (latest.current[key] === sent[key]) dirty.current.delete(key);
    }
    setStatus(dirty.current.size ? "unsaved" : "saved");
    return true;
  }, [student.id]);

  useEffect(() => {
    register({ flush, receive });
    return () => register(null);
  }, [flush, receive, register]);

  // Autosave once typing pauses.
  useEffect(() => {
    if (status !== "unsaved") return;
    const timer = setTimeout(flush, AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [notes, status, flush]);

  function edit(key: NoteKey, value: string) {
    const next = { ...notes, [key]: value };
    // Updated here too, so an immediate save (Enter) sends what was typed.
    latest.current = next;
    setNotes(next);
    dirty.current.add(key);
    setStatus("unsaved");
  }

  // Resolving a conflict: take their text, or keep mine (saved over theirs).
  function takeTheirs(key: NoteKey) {
    const theirs = conflicts[key]?.theirs ?? "";
    base.current[key] = theirs;
    latest.current = { ...latest.current, [key]: theirs };
    dirty.current.delete(key);
    setNotes((n) => ({ ...n, [key]: theirs }));
    setConflicts((c) => without(c, key));
    setStatus(dirty.current.size ? "unsaved" : "saved");
  }
  function keepMine(key: NoteKey) {
    base.current[key] = conflicts[key]?.theirs ?? "";
    setConflicts((c) => without(c, key));
    setStatus("unsaved");
  }

  async function saveNow() {
    if (await flush()) toast(`Saved notes for ${name}`);
    else toast(`Couldn't save ${name}'s notes. Try again.`);
  }

  async function copyParentEmail() {
    if (!student.parent_email) return;
    await navigator.clipboard.writeText(student.parent_email);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Activity changes save right away. Level and belt ups ask first.
  async function onActivityChange(value: string, label: string) {
    if (value === LEVEL_UP || value.startsWith(BELT_UP)) {
      // "Level Up → White 3" -> "White 3".
      const target = label.split("→")[1]?.trim() ?? "";
      setPendingProgress({
        value,
        question:
          value === LEVEL_UP
            ? `Level up ${student.first_name} to ${target}?`
            : `Belt up ${student.first_name} to ${target}?`,
      });
      return;
    }

    setPendingProgress(null);
    const chosen = activities.find((a) => activityValue(a) === value);
    if (!chosen) return;
    const previous = activity;
    setActivity(chosen);
    const result = await changeActivity(student.id, value).catch(() => null);
    if (!result?.ok) {
      setActivity(previous);
      toast(result?.error ?? "Couldn't save the activity. Try again.");
    }
  }

  // A confirmed level or belt up. Saves any pending notes first, so its line
  // lands after the latest accomplishments.
  async function confirmProgress() {
    if (!pendingProgress) return;
    const { value } = pendingProgress;
    setPendingProgress(null);
    setBusy(true);
    await flush();
    const result: ProgressResult | null = await (
      value === LEVEL_UP
        ? levelUp(student.id, belt)
        : beltUp(student.id, belt, value.split(":")[1])
    ).catch(() => null);
    setBusy(false);
    if (!result?.ok) {
      toast(result?.error ?? "Couldn't save. Try again.");
      return;
    }
    setBelt(result.belt);
    setActivity(result.activity ?? undefined);
    base.current.accomplished = result.accomplished;
    dirty.current.delete("accomplished");
    setNotes((n) => ({ ...n, accomplished: result.accomplished }));
    const stars = result.starsAdded ? ` (+${result.starsAdded} ★)` : "";
    toast(
      value === LEVEL_UP
        ? `${student.first_name} leveled up to ${capitalize(result.belt.belt_title)} ${result.belt.belt_level}${stars}`
        : `${student.first_name} belted up to ${capitalize(result.belt.belt_title)} Belt${stars}`,
    );
  }

  const statusLabel = {
    saved: "Saved",
    unsaved: "Unsaved",
    saving: "Saving…",
    error: "Not saved",
  }[status];

  return (
    <article
      className={`relative rounded-lg border border-secondary/20 p-6 text-primary transition ${
        birthday ? "pt-10" : ""
      } ${
        // --card-bg is the card's color; text uses it too so confetti hides
        // behind text instead of showing through it.
        debriefed
          ? "opacity-70 grayscale [--card-bg:var(--color-zinc-400)]"
          : isJunior
            ? "[--card-bg:var(--color-purple-100)]"
            : "[--card-bg:var(--color-surface)]"
      } bg-(--card-bg)`}
    >
      {birthday && <Confetti />}
      {/* Content sits above the confetti. */}
      <div className="relative">
        {/* Clicking anywhere in the header toggles the card, except the
          Debriefed switch. The button gives keyboard access; its clicks
          bubble up to the header's handler. */}
        <div
          onClick={() => setMinimized(!minimized)}
          className="group flex cursor-pointer items-start gap-4"
        >
          <button
            type="button"
            aria-expanded={!minimized}
            className="flex min-w-0 flex-1 items-start gap-4 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          >
            <BeltBadge belt={belt} showLevel={!minimized} birthday={birthday} />
            <span className="min-w-0 flex-1">
              <span className="block w-fit bg-(--card-bg) font-display text-xl leading-tight">
                {name}
                {birthday && <span className="sr-only"> (birthday today)</span>}
              </span>
              <span className="mt-1 block w-fit bg-(--card-bg) text-sm text-secondary">
                {activity
                  ? activityLabel(activity, activities)
                  : noActivityLabel(student)}
              </span>
              <TagChips student={student} className="mt-2 flex" />
            </span>
          </button>
          <div onClick={(e) => e.stopPropagation()} className="cursor-auto">
            <Switch
              label="Debriefed"
              checked={debriefed}
              onChange={onDebriefedChange}
            />
          </div>
          <span
            aria-hidden="true"
            className="bg-(--card-bg) px-2 text-secondary group-hover:text-primary"
          >
            {minimized ? "+" : "−"}
          </span>
        </div>

        {!minimized && (
          <>
            {/* Ctrl+Enter (Cmd+Enter on Mac) in any field saves the card;
              Enter adds a new line in the notes. */}
            <div
              className="mt-6 flex flex-col gap-4"
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  (e.ctrlKey || e.metaKey) &&
                  !e.nativeEvent.isComposing &&
                  e.target instanceof HTMLElement &&
                  e.target.matches("textarea, input")
                ) {
                  e.preventDefault();
                  saveNow();
                }
              }}
            >
              <ActivitySelect
                id={`${student.id}-activity`}
                belt={belt}
                belts={belts}
                activity={activity}
                placeholder={noActivityLabel(student)}
                activities={activities}
                disabled={busy}
                onChange={onActivityChange}
              />
              {pendingProgress && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm"
                >
                  <span>{pendingProgress.question}</span>
                  <span className="ml-auto flex gap-2">
                    <button
                      type="button"
                      autoFocus
                      onClick={confirmProgress}
                      className="rounded-md bg-tertiary px-3 py-1 text-on-primary hover:opacity-90"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingProgress(null)}
                      className="rounded-md border border-primary px-3 py-1 hover:bg-neutral"
                    >
                      Cancel
                    </button>
                  </span>
                </div>
              )}
              {noteFields.map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-2">
                  <label
                    htmlFor={`${student.id}-${key}`}
                    className="w-fit bg-(--card-bg) font-label text-xs uppercase tracking-[0.08em] text-secondary"
                  >
                    {label}
                  </label>
                  <textarea
                    id={`${student.id}-${key}`}
                    rows={4}
                    value={notes[key]}
                    maxLength={5000}
                    onChange={(e) => edit(key, e.target.value)}
                    className="resize-y rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none"
                  />
                  {conflicts[key] && (
                    <div
                      role="alert"
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm"
                    >
                      <span>
                        Updated by {shortName(conflicts[key]!.by)}:{" "}
                        <span className="text-secondary">
                          “{conflicts[key]!.theirs.slice(0, 80) || "(empty)"}
                          {conflicts[key]!.theirs.length > 80 ? "…" : ""}”
                        </span>
                      </span>
                      <span className="ml-auto flex gap-2">
                        <button
                          type="button"
                          onClick={() => takeTheirs(key)}
                          className="rounded-md border border-primary px-2 py-0.5 hover:bg-neutral"
                        >
                          Use theirs
                        </button>
                        <button
                          type="button"
                          onClick={() => keepMine(key)}
                          className="rounded-md border border-primary px-2 py-0.5 hover:bg-neutral"
                        >
                          Keep mine
                        </button>
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {note?.edited_by && note.last_edited && (
              <p className="mt-3 w-fit bg-(--card-bg) text-xs text-secondary">
                Last edited by {shortName(note.edited_by)} at{" "}
                {formatTime(note.last_edited)}
              </p>
            )}
            <div className="mt-6 flex items-center gap-4">
              {student.parent_email ? (
                <button
                  type="button"
                  onClick={copyParentEmail}
                  aria-label={`Copy parent email ${student.parent_email}`}
                  title={copied ? "Copied!" : "Copy parent email"}
                  className="flex min-w-0 items-center gap-2 rounded-md border border-primary bg-(--card-bg) px-4 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="truncate">{student.parent_email}</span>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </button>
              ) : (
                <span className="bg-(--card-bg) text-sm text-secondary">
                  No parent email
                </span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-3">
                <span
                  role="status"
                  className={`w-fit bg-(--card-bg) font-label text-xs uppercase tracking-[0.08em] ${
                    status === "error" ? "text-tertiary" : "text-secondary"
                  }`}
                >
                  {statusLabel}
                </span>
                <button
                  type="button"
                  onClick={saveNow}
                  disabled={status === "saving"}
                  className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
                >
                  Save
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

// Activities for the current level, then Level Up (below the belt's last
// level) or Belt Up (on the last level, or Junior). Moving to Bronze asks
// for a belt type (Godot or Unity).
function ActivitySelect({
  id,
  belt,
  belts,
  activity,
  activities,
  placeholder,
  disabled,
  onChange,
}: {
  id: string;
  belt: Belt;
  belts: BeltInfo[];
  activity?: Activity;
  activities: Activity[];
  // Shown when there's no current activity.
  placeholder: string;
  disabled: boolean;
  onChange: (value: string, label: string) => void;
}) {
  const info = belts.find((b) => b.belt_id === belt.belt_id);
  const canLevelUp =
    !!info?.levels &&
    belt.belt_level !== undefined &&
    belt.belt_level < info.levels;
  const next = canLevelUp ? null : nextBelt(belt, belts);
  // Choosing a type happens when moving from an untyped belt to a typed one.
  const pickType =
    next !== null &&
    beltHasType(belts, next.belt_id) &&
    !beltHasType(belts, belt.belt_id);
  const current = activity && activities.find((a) => sameActivity(a, activity));

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="w-fit bg-(--card-bg) font-label text-xs uppercase tracking-[0.08em] text-secondary"
      >
        Change activity
      </label>
      <select
        id={id}
        value={current ? activityValue(current) : ""}
        disabled={disabled}
        onChange={(e) =>
          onChange(e.target.value, e.target.selectedOptions[0]?.text ?? "")
        }
        className="rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none disabled:opacity-60"
      >
        {!current && (
          <option value="" disabled>
            {activity ? activityLabel(activity, activities) : placeholder}
          </option>
        )}
        {activities.map((a) => (
          <option key={activityValue(a)} value={activityValue(a)}>
            {activityLabel(a, activities)}
          </option>
        ))}
        {(canLevelUp || next) && <option disabled>──────────</option>}
        {canLevelUp && (
          <option value={LEVEL_UP}>
            Level Up → {capitalize(belt.belt_title)} {belt.belt_level! + 1}
          </option>
        )}
        {next &&
          (pickType ? (
            BELT_TYPES.map((type) => (
              <option key={type} value={`${BELT_UP}:${type}`}>
                Belt Up → {capitalize(next.belt_title)} Belt ({capitalize(type)}
                )
              </option>
            ))
          ) : (
            <option value={BELT_UP}>
              Belt Up → {capitalize(next.belt_title)} Belt
            </option>
          ))}
      </select>
    </div>
  );
}

function without<T extends object>(obj: T, key: keyof T): T {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

// Saved as the sensei's first name, or "Manager". Older notes have an
// email: "alex@codeninjas.com" -> "alex".
function shortName(by?: string) {
  return by ? by.split("@")[0] : "another sensei";
}

// ISO timestamp -> "3:42 PM", Pacific time.
function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Switch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex shrink-0 items-center gap-2 rounded-sm bg-(--card-bg) text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-secondary/40"
        }`}
      >
        <span
          className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface transition-transform ${
            checked ? "translate-x-5" : ""
          }`}
        />
      </span>
      {label}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path
        fill="currentColor"
        d="M8 2h11a2 2 0 0 1 2 2v13h-2V4H8V2zM5 6h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zm0 2v12h10V8H5z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
    >
      <path
        fill="currentColor"
        d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"
      />
    </svg>
  );
}
