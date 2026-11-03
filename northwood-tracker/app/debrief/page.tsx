import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { CurriculumJourney, Markdown } from "@/components/curriculum-journey";
import { getDebriefGuide } from "@/lib/debrief-guide";
import { getBelts, getCurriculum } from "@/lib/students";

export const metadata: Metadata = {
  title: "Debrief Helper · Northwood Tracker",
};

// Talking points for parent debriefs: the checklist, then the curriculum
// (like Dashboard → Curriculum) with what each belt, level, and activity
// teaches. The text comes from content/debrief-help.md.
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
      <Suspense fallback={<p className="mt-4 text-secondary">Loading…</p>}>
        <Helper />
      </Suspense>
    </main>
  );
}

async function Helper() {
  await connection();
  const guide = await getDebriefGuide();
  return (
    <>
      {guide.checklist.length > 0 && (
        <section
          aria-labelledby="checklist-title"
          className="mt-6 rounded-lg border border-secondary/20 bg-surface p-6"
        >
          <h2
            id="checklist-title"
            className="font-display text-xl leading-tight text-primary"
          >
            Debrief checklist
          </h2>
          <ol className="mt-3 grid list-decimal gap-x-8 gap-y-2 pl-5 text-primary marker:text-secondary lg:grid-cols-2">
            {guide.checklist.map((step, i) => (
              <li key={i}>
                <Markdown text={step} />
              </li>
            ))}
          </ol>
        </section>
      )}
      <p className="mt-6 text-secondary">
        Choose a belt to see what the ninja learns, then a level and an
        activity for talking points.
      </p>
      <CurriculumJourney
        belts={await getCurriculum()}
        beltInfo={await getBelts()}
        guide={guide.belts}
      />
    </>
  );
}
