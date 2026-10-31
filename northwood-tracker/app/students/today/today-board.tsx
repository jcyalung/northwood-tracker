"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/components/toast";
import type { BeltInfo, BeltPaths } from "@/lib/belts";
import { isBirthday } from "@/lib/sessions";
import type { HourGroup, SessionNote, Student } from "@/lib/students";
import {
  checkInStudent,
  saveDay as saveDayAction,
  setDebriefed as saveDebriefed,
} from "./actions";
import { AddStudentDialog } from "./add-student-dialog";
import { HourSection } from "./hour-section";
import type { CardHandle } from "./student-card";

// How often to check for other senseis' changes. Each check is one small
// request, answered with "not modified" (no data) when nothing changed.
const POLL_MS = 5000;

// Client side of Students Today: who's checked in, who's been debriefed, the
// day summary, and the hour sections. Check-ins, notes (autosaved), debriefs,
// activities, and level/belt ups all save to MongoDB.
export function TodayBoard({
  date,
  initialHours,
  notes: initialNotes,
  allStudents,
  paths,
  belts,
}: {
  date: string;
  initialHours: HourGroup[];
  // Today's saved Session Notes, by student id.
  notes: Record<string, SessionNote>;
  allStudents: Student[];
  paths: BeltPaths;
  belts: BeltInfo[];
}) {
  const toast = useToast();
  const [hours, setHours] = useState(initialHours);
  const [notes, setNotes] = useState(initialNotes);
  const [savingDay, setSavingDay] = useState(false);
  // Each card's handle: save (for Save Day) and receive live updates.
  const cards = useRef(new Map<string, CardHandle>());
  const register = useCallback((id: string, handle: CardHandle | null) => {
    if (handle) cards.current.set(id, handle);
    else cards.current.delete(id);
  }, []);
  // Debrief toggles still saving; a poll mustn't flip them back.
  const pendingDebriefs = useRef(new Set<string>());
  const [debriefed, setDebriefed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.values(initialNotes).map((n) => [n.student_id, n.debriefed]),
    ),
  );
  // Students whose card has unsaved note text.
  const [unsaved, setUnsaved] = useState<Record<string, boolean>>({});
  const onUnsavedChange = useCallback(
    (id: string, isUnsaved: boolean) =>
      setUnsaved((prev) =>
        prev[id] === isUnsaved ? prev : { ...prev, [id]: isUnsaved },
      ),
    [],
  );

  const checkedIn = hours.flatMap((h) => h.students);
  const checkedInIds = new Set(checkedIn.map((s) => s.id));
  const available = allStudents.filter((s) => !checkedInIds.has(s.id));
  const debriefCount = checkedIn.filter((s) => debriefed[s.id]).length;
  const unsavedStudents = checkedIn.filter((s) => unsaved[s.id]);
  const hasUnsaved = unsavedStudents.length > 0;

  // The browser's "Leave site?" prompt when closing, reloading, or leaving
  // with unsaved notes.
  useEffect(() => {
    if (!hasUnsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasUnsaved]);

  const birthdayIds = new Set(
    checkedIn.filter((s) => isBirthday(s.birthday, date)).map((s) => s.id),
  );

  // Shown right away, saved as a check-in, and undone if saving fails.
  async function addStudent(student: Student, hour: string) {
    const name = `${student.first_name} ${student.last_name}`;
    const update = (present: boolean) =>
      setHours((current) =>
        current.map((h) =>
          h.hour !== hour
            ? h
            : {
                ...h,
                students: present
                  ? [...h.students, student]
                  : h.students.filter((s) => s.id !== student.id),
              },
        ),
      );
    // Added once saved, so the card starts with the carried-over notes.
    const result = await checkInStudent(student.id, hour).catch(() => null);
    if (result?.ok) {
      setNotes((n) => ({ ...n, [student.id]: result.note }));
      update(true);
      toast(`Added ${name} to ${hour}`);
    } else {
      toast(result?.error ?? "Couldn't save. Try again.");
    }
  }

  // Live updates: poll for other senseis' check-ins, notes, debriefs, and
  // belt/activity changes, and merge them in. Only while the tab is visible,
  // one request at a time.
  useEffect(() => {
    let inFlight = false;
    let etag: string | null = null;
    const timer = setInterval(async () => {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch("/api/sessions/today", {
          headers: etag ? { "If-None-Match": etag } : {},
          cache: "no-store",
        });
        if (
          response.status !== 200 ||
          !response.headers.get("Content-Type")?.includes("json")
        ) {
          return;
        }
        etag = response.headers.get("ETag");
        const data: {
          date: string;
          notes: SessionNote[];
          students: Student[];
        } = await response.json();
        // After midnight the page shows yesterday; leave it until reloaded.
        if (data.date !== date) return;

        const noteById = new Map(data.notes.map((n) => [n.student_id, n]));
        const studentById = new Map(data.students.map((s) => [s.id, s]));
        setNotes(Object.fromEntries(noteById));
        setHours((current) =>
          current.map((h) => ({
            ...h,
            students: data.notes
              .filter((n) => n.session_hour === h.hour)
              .map((n) => studentById.get(n.student_id))
              .filter((s): s is Student => s !== undefined),
          })),
        );
        setDebriefed((current) => {
          const next: Record<string, boolean> = {};
          for (const n of data.notes) {
            next[n.student_id] = pendingDebriefs.current.has(n.student_id)
              ? (current[n.student_id] ?? false)
              : n.debriefed;
          }
          return next;
        });
        for (const [id, card] of cards.current) {
          card.receive(noteById.get(id), studentById.get(id));
        }
      } catch {
        // Offline or the server is busy: try again next time.
      } finally {
        inFlight = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [date]);

  // Saves right away; flips back if it fails.
  async function onDebriefedChange(id: string, checked: boolean) {
    setDebriefed((d) => ({ ...d, [id]: checked }));
    pendingDebriefs.current.add(id);
    const result = await saveDebriefed(id, checked).catch(() => null);
    pendingDebriefs.current.delete(id);
    if (!result?.ok) {
      setDebriefed((d) => ({ ...d, [id]: !checked }));
      toast(result?.error ?? "Couldn't save the debrief. Try again.");
    }
  }

  // Saves every card's pending notes, then sets everyone's last session to
  // today. Doesn't lock the day; the 6:30 PM close does that.
  async function saveDay() {
    setSavingDay(true);
    const saved = await Promise.all(
      [...cards.current.values()].map((card) => card.flush()),
    );
    const failed = saved.filter((ok) => !ok).length;
    const result = await saveDayAction().catch(() => null);
    setSavingDay(false);
    if (!result?.ok || failed) {
      toast(
        failed
          ? `Saved the day, but ${failed} card${failed === 1 ? "" : "s"} couldn't save. Try again.`
          : (result?.ok === false && result.error) ||
              "Couldn't save the day. Try again.",
      );
      return;
    }
    toast(
      `Saved the day: ${checkedIn.length} checked in, ${debriefCount} debriefed`,
    );
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[3.125rem] leading-tight text-primary">
            Students Today
          </h1>
          <p className="text-secondary">{date}</p>
        </div>
        <AddStudentDialog
          students={available}
          hours={hours.map((h) => h.hour)}
          onAdd={addStudent}
        />
      </div>

      <section
        aria-label="Day summary"
        className="mt-6 flex flex-wrap items-center gap-8 rounded-lg border border-secondary/20 bg-surface px-6 py-4"
      >
        <Stat label="Checked in" value={`${checkedIn.length}`} />
        <Stat
          label="Debriefs completed"
          value={`${debriefCount}/${checkedIn.length}`}
        />
        <button
          type="button"
          onClick={saveDay}
          disabled={savingDay}
          className="ml-auto rounded-md bg-primary px-5 py-3 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          {savingDay ? "Saving…" : "Save Day"}
        </button>
      </section>

      {hasUnsaved && (
        <p
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 px-6 py-3 text-primary"
        >
          <span aria-hidden="true" className="text-amber-600">
            ⚠
          </span>
          <span>
            <strong>Unsaved notes</strong> for{" "}
            {unsavedStudents
              .map((s) => `${s.first_name} ${s.last_name}`)
              .join(", ")}
            . Save {unsavedStudents.length === 1 ? "their card" : "each card"}{" "}
            (or press Enter in a field) before leaving.
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {hours.map(({ hour, students }) => (
          <HourSection
            key={hour}
            hour={hour}
            students={students}
            paths={paths}
            belts={belts}
            notes={notes}
            debriefed={debriefed}
            onDebriefedChange={onDebriefedChange}
            birthdayIds={birthdayIds}
            onUnsavedChange={onUnsavedChange}
            register={register}
          />
        ))}
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
        {label}
      </span>
      <span className="font-display text-2xl leading-tight text-primary">
        {value}
      </span>
    </div>
  );
}
