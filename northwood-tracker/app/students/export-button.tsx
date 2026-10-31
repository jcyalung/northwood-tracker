"use client";

import { useState } from "react";
import { useToast } from "@/components/toast";

// Chrome and Edge only; not in TypeScript's DOM types yet.
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

// Downloads every student as a CSV. Where the browser supports it, a "Save
// as" window lets the user pick the folder and file name; otherwise it's a
// normal download.
export function ExportButton() {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exportCsv() {
    const suggestedName = `northwood-students-${new Date()
      .toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })
      .replace(/\//g, "-")}.csv`;
    const picker = (window as { showSaveFilePicker?: SaveFilePicker })
      .showSaveFilePicker;

    setBusy(true);
    try {
      // Open the picker first, while the click still counts as a user
      // gesture; the browser blocks it after an await.
      const handle = picker
        ? await picker({
            suggestedName,
            types: [
              { description: "CSV file", accept: { "text/csv": [".csv"] } },
            ],
          })
        : null;

      const response = await fetch("/api/students/export");
      // A signed-out request is redirected to the login page, so check that
      // a CSV actually came back.
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.startsWith("text/csv")
      ) {
        throw new Error(`Export failed: ${response.status}`);
      }
      const blob = await response.blob();

      if (handle) {
        const file = await handle.createWritable();
        await file.write(blob);
        await file.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = suggestedName;
        link.click();
        URL.revokeObjectURL(url);
      }
      toast("Exported all students to CSV");
    } catch (error) {
      // Closing the Save window isn't an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast("Couldn't export students. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportCsv}
      disabled={busy}
      className="rounded-md border border-primary px-5 py-3 text-sm text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Exporting…" : "Export CSV"}
    </button>
  );
}
