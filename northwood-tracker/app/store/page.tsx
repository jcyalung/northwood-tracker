import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToastProvider } from "@/components/toast";
import { todayInPacific } from "@/lib/sessions";
import { getAllStudents, getSessionForDate } from "@/lib/students";
import { StoreBoard } from "./store-board";

export const metadata: Metadata = {
  title: "Star Store · Northwood Tracker",
};

export default function StarStorePage() {
  return (
    <ToastProvider>
      <main className="mx-auto w-full max-w-[79.2rem] flex-1 px-4 py-8">
        <Link
          href="/"
          className="font-label text-xs uppercase tracking-[0.08em] text-secondary hover:text-primary"
        >
          ← Menu
        </Link>
        <h1 className="mt-2 font-display text-[3.125rem] leading-tight text-primary">
          Star Store
        </h1>
        <Suspense fallback={<p className="mt-4 text-secondary">Loading…</p>}>
          <Board />
        </Suspense>
      </main>
    </ToastProvider>
  );
}

// Reads MongoDB per request so balances are current.
async function Board() {
  await connection();
  const students = await getAllStudents();
  const { hours } = await getSessionForDate(todayInPacific(), students);
  const inSession = hours.flatMap((h) => h.students.map((s) => s.id));

  return <StoreBoard students={students} inSessionIds={inSession} />;
}
