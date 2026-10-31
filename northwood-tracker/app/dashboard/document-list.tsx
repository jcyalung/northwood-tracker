"use client";

import { useState } from "react";
import { ExpandableText } from "./expandable-text";

// A document as plain JSON, with dates tagged so they render as dates.
export type DocValue =
  | string
  | number
  | boolean
  | null
  | { $date: string }
  | DocValue[]
  | { [key: string]: DocValue };

// Value colors, after MongoDB Compass (MongoDB brand palette).
const TYPE_COLORS = {
  key: "text-[#001E2B]",
  string: "text-[#00684A]",
  number: "text-[#016BF8]",
  boolean: "text-[#B45AF2]",
  date: "text-[#00684A]",
  null: "text-[#5C6C75] italic",
  muted: "text-[#5C6C75]",
};

// Longer strings are cut, with See more.
const MAX_STRING = 80;

// Read-only documents, one card each, in the style of Compass's list view.
export function DocumentList({ docs }: { docs: Record<string, DocValue>[] }) {
  return (
    <ol className="flex flex-col gap-3 p-4">
      {docs.map((doc, i) => (
        <li
          key={i}
          className="rounded-xl border border-[#E8EDEB] bg-white px-5 py-3 font-mono text-[0.8rem] leading-6 shadow-[0_1px_2px_rgba(0,30,43,0.06)]"
        >
          <Fields value={doc} />
        </li>
      ))}
    </ol>
  );
}

function Fields({ value }: { value: Record<string, DocValue> | DocValue[] }) {
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value);
  return (
    <ul>
      {entries.map(([k, v]) => (
        <Field key={k} name={k} value={v} />
      ))}
    </ul>
  );
}

function isDate(v: DocValue): v is { $date: string } {
  return (
    typeof v === "object" && v !== null && !Array.isArray(v) && "$date" in v
  );
}

function Field({ name, value }: { name: string; value: DocValue }) {
  const [open, setOpen] = useState(false);
  const nested = typeof value === "object" && value !== null && !isDate(value);

  if (nested) {
    const isArray = Array.isArray(value);
    const size = isArray ? value.length : Object.keys(value).length;
    return (
      <li>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="-ml-4 flex items-baseline gap-1 rounded-sm text-left hover:bg-[#F9FBFA] focus-visible:outline-2 focus-visible:outline-primary"
        >
          <span
            aria-hidden="true"
            className={`inline-block w-3 text-[0.65rem] ${TYPE_COLORS.muted} transition-transform ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
          <span className={`font-semibold ${TYPE_COLORS.key}`}>{name}:</span>
          <span className={TYPE_COLORS.muted}>
            {isArray ? `Array (${size})` : "Object"}
          </span>
        </button>
        {open && (
          <div className="ml-1 border-l border-[#E8EDEB] pl-5">
            <Fields value={value} />
          </div>
        )}
      </li>
    );
  }

  return (
    <li className="flex gap-1.5">
      <span className={`shrink-0 font-semibold ${TYPE_COLORS.key}`}>
        {name}:
      </span>
      <span className="min-w-0">
        <Scalar value={value} />
      </span>
    </li>
  );
}

function Scalar({ value }: { value: DocValue }) {
  if (value === null) return <span className={TYPE_COLORS.null}>null</span>;
  if (isDate(value))
    return <span className={TYPE_COLORS.date}>{value.$date}</span>;
  if (typeof value === "number") {
    return <span className={TYPE_COLORS.number}>{value}</span>;
  }
  if (typeof value === "boolean") {
    return <span className={TYPE_COLORS.boolean}>{String(value)}</span>;
  }
  return (
    <span className={TYPE_COLORS.string}>
      &quot;
      <ExpandableText text={String(value)} limit={MAX_STRING} />
      &quot;
    </span>
  );
}
