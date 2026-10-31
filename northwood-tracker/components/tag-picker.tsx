"use client";

import { TAGS } from "@/lib/options";

// Checkboxes for a student's tags. Tags a student already has that aren't in
// the standard list stay selectable.
export function TagPicker({
  value,
  onChange,
}: {
  value: string[];
  onChange: (tags: string[]) => void;
}) {
  const options = [...TAGS, ...value.filter((t) => !TAGS.includes(t))];
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-label text-xs uppercase tracking-[0.08em] text-secondary">
        Tags
      </legend>
      {options.map((name) => (
        <label key={name} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={value.includes(name)}
            onChange={(e) =>
              onChange(
                e.target.checked
                  ? [...value, name]
                  : value.filter((t) => t !== name),
              )
            }
            className="size-4 accent-primary"
          />
          {name}
        </label>
      ))}
    </fieldset>
  );
}
