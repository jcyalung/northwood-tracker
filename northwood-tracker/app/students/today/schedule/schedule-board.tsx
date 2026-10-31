"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useToast } from "@/components/toast";
import {
  activityLabel,
  noActivityLabel,
  pathKey,
  type BeltPaths,
} from "@/lib/belts";
import type { Activity, HourGroup, Student } from "@/lib/students";
import { AddStudentDialog } from "../add-student-dialog";
import { saveSchedule, type ScheduleChanges } from "../actions";
import { BeltBadge } from "../belt-badge";

type PendingRemoval = { student: Student; hour: string };

// Add students to, or remove them from, today's hours. Edits are a draft
// until Save Schedule writes them to MongoDB as check-ins, which Students
// Today reads.
export function ScheduleBoard({
  date,
  initialHours,
  allStudents,
  paths,
}: {
  date: string;
  initialHours: HourGroup[];
  allStudents: Student[];
  // Each belt level's activities, for activity labels.
  paths: BeltPaths;
}) {
  const toast = useToast();
  // `saved` is what's in MongoDB; `hours` is the draft being edited.
  const [saved, setSaved] = useState(initialHours);
  const [hours, setHours] = useState(initialHours);
  const [pending, setPending] = useState<PendingRemoval | null>(null);
  const [saving, startSaving] = useTransition();

  const changes = diff(saved, hours);
  const changeCount = changes.add.length + changes.remove.length;

  // The browser's "Leave site?" prompt while there are unsaved changes.
  useEffect(() => {
    if (changeCount === 0) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changeCount]);

  // A student is checked in to one hour per day.
  const scheduledIds = new Set(
    hours.flatMap((h) => h.students.map((s) => s.id)),
  );
  const available = allStudents.filter((s) => !scheduledIds.has(s.id));

  function addStudent(student: Student, hour: string) {
    setHours((current) => withStudent(current, hour, student, true));
  }

  function removeStudent({ student, hour }: PendingRemoval) {
    setPending(null);
    setHours((current) => withStudent(current, hour, student, false));
  }

  function save() {
    startSaving(async () => {
      const result = await saveSchedule(changes).catch(() => null);
      if (!result?.ok) {
        toast(result?.error ?? "Couldn't save the schedule. Try again.");
        return;
      }
      // Saved = the draft, minus changes that failed.
      const failedIds = new Set(result.failed.map((f) => f.studentId));
      const nowSaved = applyFailures(hours, saved, failedIds);
      setSaved(nowSaved);
      setHours(nowSaved);
      if (result.failed.length === 0) {
        toast(
          `Saved the schedule (${changeCount} ${changeCount === 1 ? "change" : "changes"})`,
        );
      } else {
        const names = result.failed
          .map((f) => {
            const s = allStudents.find((x) => x.id === f.studentId);
            return `${s ? fullName(s) : "A student"}: ${f.error}`;
          })
          .join(" · ");
        toast(`Saved, except ${names}`);
      }
    });
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[3.125rem] leading-tight text-primary">
            Schedule Students Today
          </h1>
          <p className="text-secondary">{date}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={changeCount === 0 || saving}
          className="rounded-md bg-tertiary px-5 py-3 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : changeCount === 0
              ? "Saved"
              : `Save Schedule (${changeCount})`}
        </button>
      </div>

      {changeCount > 0 && (
        <p
          role="status"
          className="mt-4 flex items-start gap-3 rounded-lg border border-amber-400 bg-amber-50 px-6 py-3 text-primary"
        >
          <span aria-hidden="true" className="text-amber-600">
            ⚠
          </span>
          <span>
            <strong>Unsaved changes:</strong>{" "}
            {changes.add.length > 0 && `${changes.add.length} added`}
            {changes.add.length > 0 && changes.remove.length > 0 && ", "}
            {changes.remove.length > 0 && `${changes.remove.length} removed`}.
            Click Save Schedule to keep them.
          </span>
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4">
        {hours.map(({ hour, students }) => (
          <details
            key={hour}
            open
            className="group rounded-lg border border-secondary/20 bg-surface"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-2xl text-primary">{hour}</span>
              <span className="flex items-center gap-3 font-label text-xs uppercase tracking-[0.08em] text-secondary">
                {students.length}{" "}
                {students.length === 1 ? "student" : "students"}
                <span className="transition-transform group-open:rotate-180">
                  ▾
                </span>
              </span>
            </summary>

            <div className="grid gap-4 px-6 pb-6 md:grid-cols-2 lg:grid-cols-3">
              {students.map((student) => (
                <BasicCard
                  key={student.id}
                  student={student}
                  levelActivities={paths[pathKey(student.belt)] ?? []}
                  onRemove={() => setPending({ student, hour })}
                />
              ))}
              <AddStudentDialog
                students={available}
                hours={[hour]}
                onAdd={addStudent}
                triggerLabel={`+ Add Student to ${hour}`}
                triggerClassName="flex min-h-24 items-center justify-center rounded-lg border-2 border-dashed border-secondary/40 px-4 text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              />
            </div>
          </details>
        ))}
      </div>

      <ConfirmRemoveDialog
        pending={pending}
        onConfirm={() => pending && removeStudent(pending)}
        onCancel={() => setPending(null)}
      />
    </>
  );
}

// What to save: students in the draft but not saved (or in a different hour)
// are added; saved students missing from the draft (or moved) are removed.
function diff(saved: HourGroup[], draft: HourGroup[]): ScheduleChanges {
  const hourOf = (hours: HourGroup[]) =>
    new Map(
      hours.flatMap((h) => h.students.map((s) => [s.id, h.hour] as const)),
    );
  const before = hourOf(saved);
  const after = hourOf(draft);
  return {
    add: [...after]
      .filter(([id, hour]) => before.get(id) !== hour)
      .map(([studentId, hour]) => ({ studentId, hour })),
    remove: [...before]
      .filter(([id, hour]) => after.get(id) !== hour)
      .map(([id]) => id),
  };
}

// After a save: each student is where the draft put them, unless their
// change failed, in which case they stay where they were saved.
function applyFailures(
  draft: HourGroup[],
  saved: HourGroup[],
  failedIds: Set<string>,
): HourGroup[] {
  const savedHour = new Map(
    saved.flatMap((h) => h.students.map((s) => [s.id, h.hour] as const)),
  );
  const savedStudent = new Map(
    saved.flatMap((h) => h.students.map((s) => [s.id, s] as const)),
  );
  return draft.map((h) => {
    const kept = h.students.filter(
      (s) => !failedIds.has(s.id) || savedHour.get(s.id) === h.hour,
    );
    const restored = [...failedIds]
      .filter(
        (id) => savedHour.get(id) === h.hour && !kept.some((s) => s.id === id),
      )
      .map((id) => savedStudent.get(id)!)
      .filter(Boolean);
    return { ...h, students: [...kept, ...restored] };
  });
}

// Adds or removes a student from an hour, without touching other hours.
function withStudent(
  hours: HourGroup[],
  hour: string,
  student: Student,
  present: boolean,
): HourGroup[] {
  return hours.map((h) =>
    h.hour !== hour
      ? h
      : {
          ...h,
          students: present
            ? [...h.students.filter((s) => s.id !== student.id), student]
            : h.students.filter((s) => s.id !== student.id),
        },
  );
}

function fullName(student: Student) {
  return `${student.first_name} ${student.last_name}`;
}

// The minimized card from Students Today, plus a remove button.
function BasicCard({
  student,
  levelActivities,
  onRemove,
}: {
  student: Student;
  levelActivities: Activity[];
  onRemove: () => void;
}) {
  const isJunior = student.belt.belt_id === 0;

  return (
    <article
      className={`flex items-start gap-4 rounded-lg border border-secondary/20 p-4 text-primary ${
        isJunior ? "bg-purple-100" : "bg-surface"
      }`}
    >
      <BeltBadge belt={student.belt} showLevel={false} />
      <div className="min-w-0 flex-1">
        <p className="font-display text-xl leading-tight">
          {fullName(student)}
        </p>
        <p className="mt-1 text-sm text-secondary">
          {student.current_activity
            ? activityLabel(student.current_activity, levelActivities)
            : noActivityLabel(student)}
        </p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${fullName(student)}`}
        title="Remove from this hour"
        className="rounded-sm px-2 text-xl leading-none text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        ×
      </button>
    </article>
  );
}

function ConfirmRemoveDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingRemoval | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-remove-title"
      // Esc or a backdrop click cancels.
      onClose={onCancel}
      onClick={(e) => e.target === dialogRef.current && onCancel()}
      className="m-auto w-full max-w-md rounded-lg bg-surface p-0 text-primary backdrop:bg-primary/40"
    >
      {pending && (
        <div className="flex flex-col gap-4 p-6">
          <h2
            id="confirm-remove-title"
            className="font-display text-2xl leading-tight"
          >
            Remove student?
          </h2>
          <p>
            Remove {fullName(pending.student)} from {pending.hour}?
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-primary px-5 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
