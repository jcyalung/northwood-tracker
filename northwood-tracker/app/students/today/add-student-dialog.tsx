"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { capitalize } from "@/lib/belts";
import type { Student } from "@/lib/students";

// "Add Student" button that opens a modal to check a student in to an hour.
// With a single hour, the hour is fixed and its field is hidden.
export function AddStudentDialog({
  students,
  hours,
  onAdd,
  triggerLabel = "+ Add Student",
  triggerClassName = "rounded-md bg-primary px-5 py-3 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
}: {
  // Students who aren't checked in yet.
  students: Student[];
  hours: string[];
  onAdd: (student: Student, hour: string) => void;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const fixedHour = hours.length === 1 ? hours[0] : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [hour, setHour] = useState("");
  // Remounts the student search so it starts empty each time.
  const [resetKey, setResetKey] = useState(0);
  const hourId = useId();

  function open() {
    setStudent(null);
    setHour(fixedHour ?? "");
    setResetKey(resetKey + 1);
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!student || !hour) return;
    onAdd(student, hour);
    close();
  }

  return (
    <>
      <button type="button" onClick={open} className={triggerClassName}>
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={`${hourId}-title`}
        // Clicking the backdrop (the dialog element itself) closes it.
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-auto w-full max-w-md rounded-lg bg-surface p-0 text-primary backdrop:bg-primary/40"
      >
        <form onSubmit={submit} className="flex flex-col gap-4 p-6">
          <h2
            id={`${hourId}-title`}
            className="font-display text-2xl leading-tight"
          >
            {fixedHour ? `Add Student to ${fixedHour}` : "Add Student"}
          </h2>

          <StudentSearch
            key={resetKey}
            students={students}
            selected={student}
            onSelect={setStudent}
          />

          <div className={fixedHour ? "hidden" : "flex flex-col gap-2"}>
            <label
              htmlFor={hourId}
              className="font-label text-xs uppercase tracking-[0.08em] text-secondary"
            >
              Hour Checked In
            </label>
            <select
              id={hourId}
              value={hour}
              onChange={(e) => setHour(e.target.value)}
              required
              className="rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none"
            >
              <option value="" disabled>
                Select an hour
              </option>
              {hours.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={close}
              className="rounded-md border border-primary px-5 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!student || !hour}
              className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function fullName(student: Student) {
  return `${student.first_name} ${student.last_name}`;
}

function beltSummary(student: Student) {
  const { belt_title, belt_level } = student.belt;
  return belt_level === undefined
    ? capitalize(belt_title)
    : `${capitalize(belt_title)} · Lvl ${belt_level}`;
}

// Searchable dropdown (combobox) of students.
function StudentSearch({
  students,
  selected,
  onSelect,
}: {
  students: Student[];
  selected: Student | null;
  onSelect: (student: Student | null) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const matches = students
    .filter((s) => fullName(s).toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => fullName(a).localeCompare(fullName(b)));

  function choose(student: Student) {
    onSelect(student);
    setQuery(fullName(student));
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive(Math.min(active + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(active - 1, 0));
    } else if (e.key === "Enter" && open) {
      // Pick the highlighted student instead of submitting the form.
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      // Close the list without closing the dialog.
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-label text-xs uppercase tracking-[0.08em] text-secondary"
      >
        Student
      </label>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={
          open && matches[active] ? `${id}-${matches[active].id}` : undefined
        }
        autoComplete="off"
        placeholder="Search by name"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
          if (selected) onSelect(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none"
      />
      {open && (
        <ul
          id={`${id}-list`}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 mt-1 max-h-60 overflow-y-auto rounded-md border border-secondary/40 bg-surface py-1"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-sm text-secondary">
              No students found
            </li>
          ) : (
            matches.map((s, i) => (
              <li
                key={s.id}
                id={`${id}-${s.id}`}
                role="option"
                aria-selected={i === active}
                // mousedown (not click) so the input doesn't blur first.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(s);
                }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-baseline justify-between gap-4 px-3 py-2 ${
                  i === active ? "bg-neutral" : ""
                }`}
              >
                <span>{fullName(s)}</span>
                <span className="text-sm text-secondary">{beltSummary(s)}</span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
