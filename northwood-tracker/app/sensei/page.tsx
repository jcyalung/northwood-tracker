import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { signOut } from "@/auth";
import { SENSEI_COOKIE } from "@/lib/current-sensei";
import { senseisCollection } from "@/lib/senseis";
import { pickSensei } from "./actions";

export const metadata: Metadata = {
  title: "Which Sensei? · Northwood Tracker",
};

export default function PickSenseiPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral px-4">
      <div className="w-full max-w-md rounded-lg border border-secondary/20 bg-surface p-6 text-primary">
        <p className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
          Code Ninjas Northwood
        </p>
        <h1 className="mt-2 font-display text-[3.125rem] leading-tight">
          Which sensei are you?
        </h1>
        <p className="mt-2 text-secondary">
          Your changes will say they were made by you.
        </p>
        <Suspense fallback={<p className="mt-6 text-secondary">Loading…</p>}>
          <SenseiChoices />
        </Suspense>
        <form
          action={async () => {
            "use server";
            (await cookies()).delete(SENSEI_COOKIE);
            await signOut({ redirectTo: "/login" });
          }}
          className="mt-6"
        >
          <button
            type="submit"
            className="text-sm text-secondary underline underline-offset-2 hover:text-primary"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

async function SenseiChoices() {
  await connection();
  const senseis = await senseisCollection()
    .find({}, { projection: { _id: 0, id: 1, first_name: 1, last_name: 1 } })
    .sort({ first_name: 1, last_name: 1 })
    .toArray();

  if (senseis.length === 0) {
    return (
      <p className="mt-6 rounded-md border border-secondary/40 px-3 py-2 text-sm">
        No senseis yet. Ask the manager to add you on Dashboard → Senseis.
      </p>
    );
  }

  return (
    <ul className="mt-6 grid gap-2 sm:grid-cols-2">
      {senseis.map((s) => (
        <li key={s.id}>
          <form action={pickSensei.bind(null, s.id)}>
            <button
              type="submit"
              className="flex w-full flex-col items-start rounded-md border border-secondary/40 px-4 py-3 text-left transition-colors hover:border-primary hover:bg-neutral focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span className="font-display text-xl leading-tight">
                {s.first_name}
              </span>
              <span className="text-sm text-secondary">{s.last_name}</span>
            </button>
          </form>
        </li>
      ))}
    </ul>
  );
}
