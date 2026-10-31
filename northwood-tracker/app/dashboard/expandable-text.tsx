"use client";

import { useState } from "react";

// Long text cut to `limit` characters, with See more / See less.
export function ExpandableText({
  text,
  limit,
}: {
  text: string;
  limit: number;
}) {
  const [open, setOpen] = useState(false);
  if (text.length <= limit) {
    return <span className="whitespace-pre-line break-words">{text}</span>;
  }

  return (
    <span className="whitespace-pre-line break-words">
      {open ? text : `${text.slice(0, limit).trimEnd()}…`}{" "}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="whitespace-nowrap text-sm text-secondary underline underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
      >
        {open ? "See less" : "See more"}
      </button>
    </span>
  );
}
