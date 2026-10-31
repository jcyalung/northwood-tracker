import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToastProvider } from "@/components/toast";
import { todayInPacific } from "@/lib/sessions";
import {
  getAllStudents,
  getBeltPaths,
  getSessionForDate,
} from "@/lib/students";
import { ScheduleBoard } from "./schedule-board";

export const metadata: Metadata = {
  title: "Schedule Students Today · Northwood Tracker",
};

export default function SchedulePage() {
  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-[79.2rem] flex-1 px-4 py-8">
        <Link
          href="/"
          className="font-label text-xs uppercase tracking-[0.08em] text-secondary hover:text-primary"
        >
          ← Menu
        </Link>
        <Suspense fallback={<p className="mt-4 text-secondary">Loading…</p>}>
          <Board />
        </Suspense>
      </main>
    </ToastProvider>
  );
}

// Rendered per request so "today" is the current date in Pacific time.
async function Board() {
  await connection();
  const date = todayInPacific();
  const students = await getAllStudents();

  return (
    <ScheduleBoard
      date={date}
      initialHours={(await getSessionForDate(date, students)).hours}
      allStudents={students}
      paths={await getBeltPaths()}
    />
  );
}
