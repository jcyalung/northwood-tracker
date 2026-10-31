import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ToastProvider } from "@/components/toast";
import {
  getAllStudents,
  getBelts,
  getPurchaseHistory,
  getSessionHistory,
} from "@/lib/students";
import { AllStudents } from "./all-students";

export const metadata: Metadata = {
  title: "All Students · Northwood Tracker",
};

export default function AllStudentsPage() {
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
          <StudentsTable />
        </Suspense>
      </main>
    </ToastProvider>
  );
}

// Reads MongoDB per request.
async function StudentsTable() {
  await connection();
  const students = await getAllStudents();

  return (
    <AllStudents
      students={students}
      history={await getSessionHistory()}
      purchases={await getPurchaseHistory()}
      belts={await getBelts()}
    />
  );
}
