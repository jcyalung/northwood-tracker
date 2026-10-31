"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { useToast } from "@/components/toast";
import { catalogPrice, STORE_CATALOG } from "@/lib/store";
import type { Student } from "@/lib/students";
import { redeemStars } from "./actions";

const OTHER = "__other__";

// Students in today's session, a search for everyone else, and the purchase
// window.
export function StoreBoard({
  students: initialStudents,
  inSessionIds,
}: {
  students: Student[];
  inSessionIds: string[];
}) {
  const toast = useToast();
  // Balances update here after each purchase.
  const [students, setStudents] = useState(initialStudents);
  const [query, setQuery] = useState("");
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const searchId = useId();

  const byName = (a: Student, b: Student) =>
    a.last_name.localeCompare(b.last_name) ||
    a.first_name.localeCompare(b.first_name);
  const inSession = new Set(inSessionIds);
  // In-session cards are sorted by first name.
  const sessionStudents = students
    .filter((s) => inSession.has(s.id))
    .sort(
      (a, b) =>
        a.first_name.localeCompare(b.first_name) ||
        a.last_name.localeCompare(b.last_name),
    );

  // Substring match on first, last, or full name.
  const q = query.trim().toLowerCase();
  const otherMatches = q
    ? students
        .filter(
          (s) =>
            !inSession.has(s.id) &&
            [s.first_name, s.last_name, `${s.first_name} ${s.last_name}`].some(
              (name) => name.toLowerCase().includes(q),
            ),
        )
        .sort(byName)
    : [];

  const buyer = students.find((s) => s.id === buyerId) ?? null;

  function onRedeemed(
    student: Student,
    item: string,
    cost: number,
    stars: number,
  ) {
    setStudents(
      students.map((s) => (s.id === student.id ? { ...s, stars } : s)),
    );
    setBuyerId(null);
    toast(
      `${student.first_name} redeemed ${item} for ${cost} ${cost === 1 ? "star" : "stars"}`,
    );
  }

  return (
    <>
      <section className="mt-8">
        <h2 className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
          In session today · {sessionStudents.length}
        </h2>
        {sessionStudents.length === 0 ? (
          <p className="mt-3 text-secondary">
            No students are checked in today.
          </p>
        ) : (
          <StudentGrid students={sessionStudents} onPick={setBuyerId} />
        )}
      </section>

      <section className="mt-10">
        <label
          htmlFor={searchId}
          className="font-label text-xs uppercase tracking-[0.08em] text-secondary"
        >
          Other students
        </label>
        <input
          id={searchId}
          type="search"
          placeholder="Search by first or last name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="mt-2 w-full max-w-md rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none"
        />
        {q && otherMatches.length === 0 && (
          <p className="mt-3 text-secondary">No other students match.</p>
        )}
        {otherMatches.length > 0 && (
          <StudentGrid students={otherMatches} onPick={setBuyerId} />
        )}
      </section>

      <PurchaseDialog
        student={buyer}
        onClose={() => setBuyerId(null)}
        onRedeemed={onRedeemed}
      />
    </>
  );
}

function StudentGrid({
  students,
  onPick,
}: {
  students: Student[];
  onPick: (id: string) => void;
}) {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {students.map((s) => (
        <li key={s.id}>
          <button
            type="button"
            onClick={() => onPick(s.id)}
            className="flex w-full flex-col items-start rounded-lg border border-secondary/20 bg-surface px-4 py-3 text-left transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <span className="leading-tight">
              {s.first_name} {s.last_name}
            </span>
            <span className="mt-1 text-sm text-secondary">
              ★ {(s.stars ?? 0).toLocaleString("en-US")}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function PurchaseDialog({
  student,
  onClose,
  onRedeemed,
}: {
  student: Student | null;
  onClose: () => void;
  onRedeemed: (
    student: Student,
    item: string,
    cost: number,
    stars: number,
  ) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isOpen = student !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="purchase-title"
      onClose={onClose}
      onClick={(e) => e.target === dialogRef.current && onClose()}
      className="m-auto w-full max-w-md rounded-lg bg-surface p-0 text-primary backdrop:bg-primary/40"
    >
      {student && (
        // Keyed so the form starts empty for each student.
        <PurchaseForm
          key={student.id}
          student={student}
          onCancel={onClose}
          onRedeemed={onRedeemed}
        />
      )}
    </dialog>
  );
}

const INPUT =
  "w-full rounded-md border border-secondary/40 bg-surface px-3 py-2 focus:border-primary focus:outline-none";
const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";

function PurchaseForm({
  student,
  onCancel,
  onRedeemed,
}: {
  student: Student;
  onCancel: () => void;
  onRedeemed: (
    student: Student,
    item: string,
    cost: number,
    stars: number,
  ) => void;
}) {
  const [choice, setChoice] = useState("");
  const [otherItem, setOtherItem] = useState("");
  const [otherStars, setOtherStars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ids = useId();

  const isOther = choice === OTHER;
  const item = isOther ? otherItem.trim() : choice;
  const cost = isOther ? Number(otherStars) : (catalogPrice(choice) ?? 0);
  const validCost = Number.isInteger(cost) && cost > 0;
  const balance = student.stars ?? 0;
  const after = balance - (validCost ? cost : 0);
  const canAfford = after >= 0;
  const canConfirm = item !== "" && validCost && canAfford && !pending;

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await redeemStars({
          studentId: student.id,
          item,
          stars: cost,
        });
        if (result.ok) onRedeemed(student, item, cost, result.stars);
        else setError(result.error);
      } catch {
        setError("Couldn't reach the database. Try again.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-6">
      <div>
        <h2 id="purchase-title" className="font-display text-2xl leading-tight">
          {student.first_name} {student.last_name}
        </h2>
        <p className="mt-1 text-secondary">
          ★ {balance.toLocaleString("en-US")} stars
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-item`} className={LABEL}>
          Item to purchase
        </label>
        <select
          id={`${ids}-item`}
          required
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value);
            setError(null);
          }}
          className={INPUT}
        >
          <option value="" disabled>
            Select an item
          </option>
          {STORE_CATALOG.map(({ category, items }) => (
            <optgroup key={category} label={category}>
              {items.map((i) => (
                <option key={i.name} value={i.name}>
                  {i.name} · {i.stars} ★
                </option>
              ))}
            </optgroup>
          ))}
          <option value={OTHER}>Other…</option>
        </select>
        {isOther && (
          <input
            aria-label="Item name"
            required
            maxLength={80}
            placeholder="What are they buying?"
            value={otherItem}
            onChange={(e) => setOtherItem(e.target.value)}
            className={INPUT}
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${ids}-stars`} className={LABEL}>
          Stars
        </label>
        {isOther ? (
          <input
            id={`${ids}-stars`}
            type="number"
            required
            min={1}
            step={1}
            inputMode="numeric"
            value={otherStars}
            onChange={(e) => setOtherStars(e.target.value)}
            className={INPUT}
          />
        ) : (
          <input
            id={`${ids}-stars`}
            readOnly
            value={choice ? cost : ""}
            placeholder="Set by the item"
            className={`${INPUT} bg-neutral`}
          />
        )}
      </div>

      <p className="flex items-baseline justify-between border-t border-secondary/20 pt-4">
        <span className={LABEL}>Stars after</span>
        <span
          className={`font-display text-2xl ${canAfford ? "" : "text-tertiary"}`}
        >
          {after.toLocaleString("en-US")}
        </span>
      </p>
      {!canAfford && (
        <p className="text-sm text-tertiary">
          Not enough stars for this purchase.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-tertiary">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-primary px-5 py-2 text-sm transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canConfirm}
          className="rounded-md bg-tertiary px-5 py-2 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "Redeeming…" : "Confirm"}
        </button>
      </div>
    </form>
  );
}
