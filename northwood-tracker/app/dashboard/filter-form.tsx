"use client";

import Form from "next/form";
import type { ReactNode } from "react";

// GET form to /dashboard that applies as soon as a dropdown changes (search
// text applies on Enter). Navigates client-side via next/form. Empty fields
// ("Any", blank search) are left out of the URL.
export function FilterForm({ children }: { children: ReactNode }) {
  return (
    <Form
      action="/dashboard"
      onSubmit={(e) => {
        const empty = [...e.currentTarget.elements].filter(
          (el): el is HTMLInputElement | HTMLSelectElement =>
            (el instanceof HTMLInputElement ||
              el instanceof HTMLSelectElement) &&
            el.name !== "" &&
            el.value === "",
        );
        // Disabled fields aren't submitted; re-enable once it's sent.
        empty.forEach((el) => (el.disabled = true));
        setTimeout(() => empty.forEach((el) => (el.disabled = false)));
      }}
      onChange={(e) => {
        if (e.target instanceof HTMLSelectElement)
          e.currentTarget.requestSubmit();
      }}
      className="flex flex-col gap-4"
    >
      {children}
    </Form>
  );
}
