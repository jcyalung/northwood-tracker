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

// A file the export button downloads: where from, what it's called, and
// what to say about it.
export type ExportFile = {
  url: string;
  // File name before the date and extension, e.g. "northwood-students".
  name: string;
  extension: "csv" | "json";
  // For the "Save as" window, e.g. "CSV file".
  description: string;
  mimeType: string;
  label: string;
  done: string;
  failed: string;
};

// Downloads a file from the app. Where the browser supports it, a "Save as"
// window lets the user pick the folder and file name; otherwise it's a
// normal download.
export function ExportButton({ file }: { file: ExportFile }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function exportFile() {
    const suggestedName = `${file.name}-${new Date()
      .toLocaleDateString("en-US", { timeZone: "America/Los_Angeles" })
      .replace(/\//g, "-")}.${file.extension}`;
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
              {
                description: file.description,
                accept: { [file.mimeType]: [`.${file.extension}`] },
              },
            ],
          })
        : null;

      const response = await fetch(file.url);
      // A signed-out request is redirected to the login page, so check that
      // the right kind of file actually came back.
      if (
        !response.ok ||
        !response.headers.get("Content-Type")?.startsWith(file.mimeType)
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
      toast(file.done);
    } catch (error) {
      // Closing the Save window isn't an error.
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast(file.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={exportFile}
      disabled={busy}
      className="rounded-md border border-primary px-5 py-3 text-sm text-primary transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? "Exporting…" : file.label}
    </button>
  );
}
