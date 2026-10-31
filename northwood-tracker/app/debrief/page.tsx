import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Debrief Helper · Northwood Tracker",
};

// Placeholder until the Debrief Helper is designed.
export default function DebriefHelperPage() {
  return (
    <main className="mx-auto w-full max-w-[79.2rem] flex-1 px-4 py-8">
      <Link
        href="/"
        className="font-label text-xs uppercase tracking-[0.08em] text-secondary hover:text-primary"
      >
        ← Menu
      </Link>
      <h1 className="mt-2 font-display text-[3.125rem] leading-tight text-primary">
        Debrief Helper
      </h1>

      <section className="mt-8 flex flex-col items-center rounded-lg border border-dashed border-secondary/40 bg-surface px-6 py-16 text-center">
        <span className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
          In development
        </span>
        <p className="mt-2 font-display text-2xl text-primary">
          This page is coming soon.
        </p>
        <p className="mt-2 max-w-md text-secondary">
          The Debrief Helper is still being built. Check back later.
        </p>
        <Link
          href="/"
          className="mt-6 rounded-md border border-primary px-5 py-2 text-sm text-primary transition-colors hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Back to Menu
        </Link>
      </section>
    </main>
  );
}
