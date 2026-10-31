"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useToast } from "@/components/toast";
import {
  BELT_TYPES,
  beltHasType,
  capitalize,
  type BeltInfo,
} from "@/lib/belts";
import { TagChips } from "@/components/tag-chips";
import { TagPicker } from "@/components/tag-picker";
import { activeTags } from "@/lib/tags";
import { PROGRAMS } from "@/lib/options";
import type { PurchaseRecord, SessionNote, Student } from "@/lib/students";
import { ExportButton } from "./export-button";
import { updateStudent, type StudentEdits } from "./actions";
import { NewStudentDialog } from "./new-student-dialog";
import { BeltBadge } from "./today/belt-badge";

const SORTS = {
  "a-z": "A–Z (last name)",
  recent: "Most recent session",
  oldest: "Least recent session",
} as const;
type Sort = keyof typeof SORTS;

type Filters = {
  query: string;
  program: string;
  belt: string;
  type: string;
  attendance: string;
  sort: Sort;
};

const PAGE_SIZE = 20;

const NO_FILTERS: Filters = {
  query: "",
  program: "",
  belt: "",
  type: "",
  attendance: "",
  sort: "a-z",
};

export function AllStudents({
  students: initialStudents,
  history,
  purchases,
  belts,
}: {
  students: Student[];
  history: Record<string, SessionNote[]>;
  // Purchases by student, from the purchases collection.
  purchases: Record<string, PurchaseRecord[]>;
  // Every belt, from the `belts` collection.
  belts: BeltInfo[];
}) {
  const toast = useToast();
  // Edits are kept here until the Students collection is hooked up.
  const [students, setStudents] = useState(initialStudents);
  const [filters, setFilters] = useState(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = students.find((s) => s.id === selectedId) ?? null;

  function addStudent(student: Student) {
    setStudents([...students, student]);
    toast(`Added ${student.first_name} ${student.last_name}`);
  }

  // Saves to MongoDB; the page shows what was stored. Returns whether it saved.
  async function saveStudent(id: string, edits: StudentEdits) {
    const result = await updateStudent(id, edits).catch(() => null);
    if (!result?.ok) {
      toast(result?.error ?? "Couldn't save. Try again.");
      return false;
    }
    setStudents((all) => all.map((s) => (s.id === id ? result.student : s)));
    toast(
      `Saved changes for ${result.student.first_name} ${result.student.last_name}`,
    );
    return true;
  }

  const rows = filterAndSort(students, filters);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // Clamp in case the current page no longer exists.
  const currentPage = Math.min(page, pageCount);
  const first = (currentPage - 1) * PAGE_SIZE;
  const pageRows = rows.slice(first, first + PAGE_SIZE);

  // Changing a filter or the sort goes back to the first page.
  function set<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters({ ...filters, [key]: value });
    setPage(1);
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-[3.125rem] leading-tight text-primary">
          All Students
        </h1>
        <div className="flex items-center gap-3">
          <ExportButton />
          <NewStudentDialog belts={belts} onCreated={addStudent} />
        </div>
      </div>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[18rem_1fr]">
        <aside
          aria-label="Search and filters"
          className="flex flex-col gap-4 rounded-lg border border-secondary/20 bg-surface p-6 lg:sticky lg:top-6"
        >
          <Field label="Search">
            {(id) => (
              <input
                id={id}
                type="search"
                placeholder="First or last name"
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                className={INPUT}
              />
            )}
          </Field>
          <Select
            label="Program"
            value={filters.program}
            onChange={(v) => set("program", v)}
            options={PROGRAMS.map((p) => [p, p])}
          />
          <Select
            label="Belt Color"
            value={filters.belt}
            onChange={(v) => set("belt", v)}
            // Junior is covered by the Program filter.
            options={belts
              .filter((b) => b.belt_id > 0)
              .map(({ belt_id: id, title }) => [String(id), capitalize(title)])}
          />
          <Select
            label="Type"
            value={filters.type}
            onChange={(v) => set("type", v)}
            options={BELT_TYPES.map((t) => [t, capitalize(t)])}
          />
          <Select
            label="Attendance"
            value={filters.attendance}
            onChange={(v) => set("attendance", v)}
            options={[
              ["attended", "Attended before"],
              ["never", "Never attended"],
            ]}
          />
          <Select
            label="Sort by"
            value={filters.sort}
            onChange={(v) => set("sort", v as Sort)}
            options={Object.entries(SORTS)}
            allowAll={false}
          />
          <button
            type="button"
            onClick={() => {
              setFilters(NO_FILTERS);
              setPage(1);
            }}
            className="mt-2 rounded-md border border-secondary/40 px-4 py-2 text-sm text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Clear filters
          </button>
        </aside>

        <section className="overflow-x-auto rounded-lg border border-secondary/20 bg-surface">
          <p className="px-6 pt-4 font-label text-xs uppercase tracking-[0.08em] text-secondary">
            {rows.length === students.length
              ? `${students.length} students`
              : `${rows.length} of ${students.length} students`}
          </p>
          <table className="w-full text-left">
            <thead>
              <tr className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Program</th>
                <th className="px-6 py-3">Belt</th>
                <th className="px-6 py-3">Last Session</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((student) => (
                <tr
                  key={student.id}
                  onClick={() => setSelectedId(student.id)}
                  className="cursor-pointer border-t border-secondary/20 transition-colors hover:bg-neutral"
                >
                  <td className="px-6 py-3">
                    {/* The button gives keyboard access; its click bubbles to the row. */}
                    <button
                      type="button"
                      className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      {student.first_name} {student.last_name}
                    </button>
                    <TagChips student={student} className="mt-1 flex" />
                  </td>
                  <td className="px-6 py-3 text-secondary">
                    {student.program ?? "—"}
                  </td>
                  <td className="px-6 py-3">
                    <BeltCell student={student} />
                  </td>
                  <td className="px-6 py-3 text-secondary">
                    {student.last_session
                      ? formatDate(student.last_session)
                      : "Never"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr className="border-t border-secondary/20">
                  <td colSpan={4} className="px-6 py-6 text-secondary">
                    No students match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {rows.length > 0 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-between gap-4 border-t border-secondary/20 px-6 py-3"
            >
              <span className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
                {first + 1}–{first + pageRows.length} of {rows.length}
              </span>
              <span className="flex items-center gap-3">
                <PageButton
                  onClick={() => setPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  ← Prev
                </PageButton>
                <span className="text-sm text-secondary">
                  Page {currentPage} of {pageCount}
                </span>
                <PageButton
                  onClick={() => setPage(currentPage + 1)}
                  disabled={currentPage === pageCount}
                >
                  Next →
                </PageButton>
              </span>
            </nav>
          )}
        </section>

        <StudentDialog
          student={selected}
          history={selected ? (history[selected.id] ?? []) : []}
          purchases={selected ? (purchases[selected.id] ?? []) : []}
          belts={belts}
          onSave={saveStudent}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </>
  );
}

function PageButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-secondary/40 px-3 py-1 text-sm transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-secondary/40"
    >
      {children}
    </button>
  );
}

function filterAndSort(students: Student[], f: Filters): Student[] {
  const query = f.query.trim().toLowerCase();

  const rows = students.filter((s) => {
    // Substring match on first, last, or full name.
    if (
      query &&
      ![s.first_name, s.last_name, `${s.first_name} ${s.last_name}`].some(
        (name) => name.toLowerCase().includes(query),
      )
    )
      return false;
    if (f.program && s.program !== f.program) return false;
    if (f.belt && String(s.belt.belt_id) !== f.belt) return false;
    if (f.type && s.belt.belt_type !== f.type) return false;
    if (f.attendance === "attended" && !s.last_session) return false;
    if (f.attendance === "never" && s.last_session) return false;
    return true;
  });

  const byName = (a: Student, b: Student) =>
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name);

  return rows.sort((a, b) => {
    if (f.sort === "a-z") return byName(a, b);
    // Students who've never attended go last either way.
    if (!a.last_session || !b.last_session) {
      return Number(!a.last_session) - Number(!b.last_session) || byName(a, b);
    }
    const diff = dateKey(a.last_session) - dateKey(b.last_session);
    return (f.sort === "recent" ? -diff : diff) || byName(a, b);
  });
}

// MM/DD/YYYY -> YYYYMMDD for sorting.
function dateKey(date: string) {
  const [m, d, y] = date.split("/").map(Number);
  return y * 10000 + m * 100 + d;
}

function formatDate(date: string) {
  const [m, d, y] = date.split("/").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function beltLabel(student: Student) {
  const { belt_title, belt_level, belt_type } = student.belt;
  return [
    capitalize(belt_title),
    belt_level !== undefined && `Lvl ${belt_level}`,
    belt_type && capitalize(belt_type),
  ]
    .filter(Boolean)
    .join(" · ");
}

function BeltCell({ student }: { student: Student }) {
  const { belt_id, belt_title } = student.belt;
  return (
    <span className="flex items-center gap-3">
      {belt_id > 0 ? (
        <Image
          src={`/icons/${belt_title}.svg`}
          alt=""
          width={32}
          height={32}
          className="size-8"
        />
      ) : (
        <span className="size-8" />
      )}
      {beltLabel(student)}
    </span>
  );
}

const INPUT =
  "rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: (id: string) => ReactNode;
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

function Select({
  label,
  value,
  onChange,
  options,
  allowAll = true,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  allowAll?: boolean;
}) {
  return (
    <Field label={label}>
      {(id) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={INPUT}
        >
          {allowAll && <option value="">All</option>}
          {options.map(([v, text]) => (
            <option key={v} value={v}>
              {text}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

function StudentDialog({
  student,
  history,
  purchases,
  belts,
  onSave,
  onClose,
}: {
  student: Student | null;
  history: SessionNote[];
  purchases: PurchaseRecord[];
  belts: BeltInfo[];
  onSave: (id: string, edits: StudentEdits) => Promise<boolean>;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [editing, setEditing] = useState(false);
  const isOpen = student !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  function close() {
    setEditing(false);
    onClose();
  }

  const sessions = [...history].sort(
    (a, b) => dateKey(b.session_date) - dateKey(a.session_date),
  );

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="student-dialog-title"
      // Esc or a backdrop click closes it.
      onClose={close}
      onClick={(e) => e.target === dialogRef.current && close()}
      className="m-auto max-h-[85vh] w-full max-w-2xl rounded-lg bg-surface p-0 text-primary backdrop:bg-primary/40"
    >
      {student && (
        <div className="flex flex-col gap-6 p-6">
          <div className="flex items-start gap-4">
            <BeltBadge belt={student.belt} showLevel={false} />
            <div className="min-w-0 flex-1">
              <h2
                id="student-dialog-title"
                className="font-display text-2xl leading-tight"
              >
                {student.first_name} {student.last_name}
              </h2>
              <p className="mt-1 text-sm text-secondary">
                {[student.program, beltLabel(student)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {!editing && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md border border-primary px-4 py-1 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Edit
              </button>
            )}
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="rounded-sm px-2 text-2xl leading-none text-secondary hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
            >
              ×
            </button>
          </div>

          {editing ? (
            <StudentEditForm
              student={student}
              belts={belts}
              onCancel={() => setEditing(false)}
              onSave={async (edits) => {
                if (await onSave(student.id, edits)) setEditing(false);
              }}
            />
          ) : (
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Parent Email"
                value={student.parent_email ?? undefined}
              />
              <Detail
                label="Birthday"
                value={
                  student.birthday ? formatDate(student.birthday) : undefined
                }
              />
              <Detail label="Debrief Method" value={student.debrief_method} />
              <div>
                <dt className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
                  Tags
                </dt>
                <dd className="mt-1">
                  {activeTags(student).length ? (
                    <TagChips student={student} />
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <Detail
                label="Stars"
                value={
                  student.stars === undefined
                    ? undefined
                    : student.stars.toLocaleString("en-US")
                }
              />
              <div className="sm:col-span-2">
                <Detail label="Notes" value={student.notes} />
              </div>
            </dl>
          )}

          <section>
            <h3 className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
              Session History
            </h3>
            {sessions.length === 0 ? (
              <p className="mt-2 text-secondary">No sessions yet.</p>
            ) : (
              <ol className="mt-2 flex flex-col gap-3">
                {sessions.map((note) => (
                  <li
                    key={note.session_id}
                    className="rounded-md border border-secondary/20 p-4"
                  >
                    <p className="font-display text-lg leading-tight">
                      {formatDate(note.session_date)}
                      <span className="ml-2 text-sm text-secondary">
                        {note.session_hour}
                      </span>
                    </p>
                    <dl className="mt-2 flex flex-col gap-2 text-sm">
                      <Detail label="Notes" value={note.working_on} />
                      {note.accomplished && (
                        <Detail
                          label="Accomplishments"
                          value={note.accomplished}
                        />
                      )}
                      <Detail label="Next Time" value={note.next_steps} />
                    </dl>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <PurchaseHistory purchases={purchases} />
        </div>
      )}
    </dialog>
  );
}

// Star Store purchases, newest first. Ones from before this app (imported
// from the stars spreadsheet) have no date.
function PurchaseHistory({ purchases }: { purchases: PurchaseRecord[] }) {
  const total = purchases.reduce((n, p) => n + p.stars_used, 0);
  return (
    <section>
      <h3 className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
        Purchase History
      </h3>
      {purchases.length === 0 ? (
        <p className="mt-2 text-secondary">No purchases yet.</p>
      ) : (
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
              <th className="py-1.5">Item</th>
              <th className="py-1.5 text-right">Qty</th>
              <th className="py-1.5 text-right">Stars</th>
              <th className="py-1.5 text-right">Date</th>
            </tr>
          </thead>
          <tbody>
            {purchases.map((p, i) => (
              <tr key={i} className="border-t border-secondary/20">
                <td className="py-1.5">{p.item_purchased}</td>
                <td className="py-1.5 text-right tabular-nums">{p.quantity}</td>
                <td className="py-1.5 text-right tabular-nums">
                  {p.stars_used.toLocaleString("en-US")} ★
                </td>
                <td className="py-1.5 text-right text-secondary">
                  {p.date_purchased
                    ? new Intl.DateTimeFormat("en-US", {
                        timeZone: "America/Los_Angeles",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      }).format(new Date(p.date_purchased))
                    : "Before tracker"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-secondary/40">
              <td className="py-1.5" colSpan={2}>
                Total spent
              </td>
              <td className="py-1.5 text-right tabular-nums">
                {total.toLocaleString("en-US")} ★
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
        {label}
      </dt>
      <dd className="whitespace-pre-line">{value || "—"}</dd>
    </div>
  );
}

// Edits parent email, belt (color, level, type), program, tags, and notes.
function StudentEditForm({
  student,
  belts,
  onSave,
  onCancel,
}: {
  student: Student;
  belts: BeltInfo[];
  // Resolves once saved (or failed; the form stays open then).
  onSave: (edits: StudentEdits) => Promise<void>;
  onCancel: () => void;
}) {
  const [email, setEmail] = useState(student.parent_email ?? "");
  const [beltId, setBeltId] = useState(student.belt.belt_id);
  const [level, setLevel] = useState(student.belt.belt_level ?? 1);
  const [beltType, setBeltType] = useState<string>(
    student.belt.belt_type ?? BELT_TYPES[0],
  );
  const [program, setProgram] = useState(student.program ?? "");
  const [tags, setTags] = useState(() => activeTags(student));
  const [notes, setNotes] = useState(student.notes ?? "");
  const currentStars = student.stars ?? 0;
  const [stars, setStars] = useState(String(currentStars));
  const [starsPassword, setStarsPassword] = useState("");
  // A different balance needs the stars password.
  const starsChanged = stars.trim() !== "" && Number(stars) !== currentStars;

  const isJunior = beltId === 0;
  const hasType = beltHasType(belts, beltId);
  // The belt's real level count; at least the student's current level.
  const levelCount = Math.max(
    belts.find((b) => b.belt_id === beltId)?.levels ?? 1,
    student.belt.belt_id === beltId ? (student.belt.belt_level ?? 1) : 1,
  );

  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      // Blank means not known yet.
      parent_email: email.trim() || null,
      belt_id: beltId,
      belt_level: level,
      belt_type: beltType,
      program,
      tags,
      notes,
      ...(starsChanged && { stars: Number(stars), starsPassword }),
    });
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Parent Email">
          {(id) => (
            <input
              id={id}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${INPUT} w-full`}
            />
          )}
        </Field>
      </div>
      <Select
        label="Belt Color"
        value={String(beltId)}
        onChange={(v) => setBeltId(Number(v))}
        options={belts.map(({ belt_id: id, title }) => [
          String(id),
          capitalize(title),
        ])}
        allowAll={false}
      />
      {isJunior ? (
        <Field label="Level">
          {(id) => (
            <select id={id} disabled className={`${INPUT} opacity-50`}>
              <option>No levels for Junior</option>
            </select>
          )}
        </Field>
      ) : (
        <Select
          label="Level"
          value={String(level)}
          onChange={(v) => setLevel(Number(v))}
          options={Array.from({ length: levelCount }, (_, i) => [
            String(i + 1),
            `Level ${i + 1}`,
          ])}
          allowAll={false}
        />
      )}
      {hasType && (
        <Select
          label="Type"
          value={beltType}
          onChange={setBeltType}
          options={BELT_TYPES.map((t) => [t, capitalize(t)])}
          allowAll={false}
        />
      )}
      <Select
        label="Program"
        value={program}
        onChange={setProgram}
        options={PROGRAMS.map((p) => [p, p])}
        allowAll={false}
      />
      <TagPicker value={tags} onChange={setTags} />
      <div className="flex flex-col gap-4">
        <Field label="Stars">
          {(id) => (
            <input
              id={id}
              type="number"
              step={1}
              inputMode="numeric"
              value={stars}
              onChange={(e) => setStars(e.target.value)}
              className={`${INPUT} w-full`}
            />
          )}
        </Field>
        {starsChanged && (
          <Field label="Password to change stars">
            {(id) => (
              <input
                id={id}
                type="password"
                required
                autoComplete="off"
                value={starsPassword}
                onChange={(e) => setStarsPassword(e.target.value)}
                className={`${INPUT} w-full`}
              />
            )}
          </Field>
        )}
      </div>

      <div className="sm:col-span-2">
        <Field label="Notes">
          {(id) => (
            <textarea
              id={id}
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={`${INPUT} w-full resize-y`}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-primary px-5 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
