"use client";

import { useId, useRef, useState, useTransition, type FormEvent } from "react";
import {
  BELT_TYPES,
  beltHasType,
  capitalize,
  type BeltInfo,
} from "@/lib/belts";
import { TagPicker } from "@/components/tag-picker";
import { DEBRIEF_METHODS, PROGRAMS } from "@/lib/options";
import type { Student } from "@/lib/students";
import { createStudent, type NewStudentInput } from "./actions";

const EMPTY: NewStudentInput = {
  first_name: "",
  last_name: "",
  parent_email: "",
  birthday: "",
  program: "Create",
  belt_id: 1,
  belt_level: 1,
  belt_type: BELT_TYPES[0],
  debrief_method: "",
  tags: [],
  notes: "",
};

const INPUT =
  "w-full rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none";

// "New Student" button and the form that inserts a student into MongoDB.
export function NewStudentDialog({
  belts,
  onCreated,
}: {
  // Every belt, from the `belts` collection.
  belts: BeltInfo[];
  onCreated: (student: Student) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const titleId = useId();

  const isJunior = form.belt_id === 0;
  const hasType = beltHasType(belts, form.belt_id);
  const levelCount = belts.find((b) => b.belt_id === form.belt_id)?.levels ?? 1;

  function set<K extends keyof NewStudentInput>(
    key: K,
    value: NewStudentInput[K],
  ) {
    setForm({ ...form, [key]: value });
  }

  function open() {
    setForm(EMPTY);
    setError(null);
    dialogRef.current?.showModal();
  }

  function close() {
    if (!pending) dialogRef.current?.close();
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const result = await createStudent(form);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        dialogRef.current?.close();
        onCreated(result.student);
      } catch {
        setError("Couldn't reach the database. Try again.");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="rounded-md bg-primary px-5 py-3 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        + New Student
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        // Esc is blocked while saving; a backdrop click closes it.
        onCancel={(e) => pending && e.preventDefault()}
        onClick={(e) => e.target === dialogRef.current && close()}
        className="m-auto max-h-[96vh] w-full max-w-2xl rounded-lg bg-surface p-0 text-primary backdrop:bg-primary/40"
      >
        <form onSubmit={submit} className="grid gap-5 p-8 sm:grid-cols-2">
          <h2
            id={titleId}
            className="font-display text-2xl leading-tight sm:col-span-2"
          >
            New Student
          </h2>

          <Field label="First Name">
            {(id) => (
              <input
                id={id}
                required
                autoComplete="off"
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Field label="Last Name">
            {(id) => (
              <input
                id={id}
                required
                autoComplete="off"
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Field label="Parent Email">
            {(id) => (
              <input
                id={id}
                type="email"
                required
                autoComplete="off"
                value={form.parent_email}
                onChange={(e) => set("parent_email", e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Field label="Birthday">
            {(id) => (
              <input
                id={id}
                type="date"
                required
                value={form.birthday}
                onChange={(e) => set("birthday", e.target.value)}
                className={INPUT}
              />
            )}
          </Field>

          <Field label="Program">
            {(id) => (
              <select
                id={id}
                value={form.program}
                onChange={(e) => set("program", e.target.value)}
                className={INPUT}
              >
                {PROGRAMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Belt Color">
            {(id) => (
              <select
                id={id}
                value={form.belt_id}
                // A new belt starts at level 1 (it may have fewer levels).
                onChange={(e) =>
                  setForm({
                    ...form,
                    belt_id: Number(e.target.value),
                    belt_level: 1,
                  })
                }
                className={INPUT}
              >
                {belts.map(({ belt_id: beltId, title }) => (
                  <option key={beltId} value={beltId}>
                    {capitalize(title)}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Level">
            {(id) =>
              isJunior ? (
                <select id={id} disabled className={`${INPUT} opacity-50`}>
                  <option>No levels for Junior</option>
                </select>
              ) : (
                <select
                  id={id}
                  value={form.belt_level}
                  onChange={(e) => set("belt_level", Number(e.target.value))}
                  className={INPUT}
                >
                  {Array.from({ length: levelCount }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Level {i + 1}
                    </option>
                  ))}
                </select>
              )
            }
          </Field>
          {hasType ? (
            <Field label="Type">
              {(id) => (
                <select
                  id={id}
                  value={form.belt_type}
                  onChange={(e) => set("belt_type", e.target.value)}
                  className={INPUT}
                >
                  {BELT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {capitalize(t)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : (
            // Keeps the grid aligned when there's no Type field.
            <div className="hidden sm:block" />
          )}

          <Field label="Debrief Method">
            {(id) => (
              <select
                id={id}
                value={form.debrief_method}
                onChange={(e) => set("debrief_method", e.target.value)}
                className={INPUT}
              >
                <option value="">Not set</option>
                {DEBRIEF_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            )}
          </Field>
          <TagPicker value={form.tags} onChange={(tags) => set("tags", tags)} />
          <div className="sm:col-span-2">
            <Field label="Notes">
              {(id) => (
                <textarea
                  id={id}
                  rows={5}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  // Enter adds a new line; Ctrl+Enter (Cmd+Enter on Mac) saves.
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      (e.ctrlKey || e.metaKey) &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      e.currentTarget.form?.requestSubmit();
                    }
                  }}
                  className={`${INPUT} resize-y`}
                />
              )}
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              className="rounded-md border border-tertiary px-3 py-2 text-sm text-tertiary sm:col-span-2"
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={close}
              disabled={pending}
              className="rounded-md border border-primary px-5 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? "Adding…" : "Add Student"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-label text-xs uppercase tracking-[0.08em] text-secondary"
      >
        {label}
      </label>
      {children(id)}
    </div>
  );
}
