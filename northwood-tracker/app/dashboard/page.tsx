import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { buildDashboard, PURPLE } from "@/lib/dashboard";
import { todayInPacific } from "@/lib/sessions";
import {
  getAllStudents,
  getBelts,
  getSessionForDate,
  getCurriculum,
  getSessionHistory,
} from "@/lib/students";
import { ChartCard, ColumnChart, PieChart, StatTile } from "./charts";
import { CurriculumJourney } from "./curriculum-journey";
import { DatabaseView, type DbQuery } from "./database-view";
import { SenseisPanel } from "./senseis-panel";
import { auth } from "@/auth";
import { senseisCollection } from "@/lib/senseis";

export const metadata: Metadata = {
  title: "Dashboard · Northwood Tracker",
};

export default function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  return (
    <main className="mx-auto w-full max-w-[79.2rem] flex-1 px-4 py-8">
      <Link
        href="/"
        className="font-label text-xs uppercase tracking-[0.08em] text-secondary hover:text-primary"
      >
        ← Menu
      </Link>
      <h1 className="mt-2 font-display text-[3.125rem] leading-tight text-primary">
        Dashboard
      </h1>
      <Suspense fallback={<p className="mt-4 text-secondary">Loading…</p>}>
        <Tabbed searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "curriculum", label: "Curriculum" },
  { id: "senseis", label: "Senseis" },
  { id: "database", label: "Database" },
] as const;

// ?tab=overview (default) or ?tab=database (&collection=…&page=…).
async function Tabbed({
  searchParams,
}: {
  searchParams: PageProps<"/dashboard">["searchParams"];
}) {
  const params = await searchParams;
  const one = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const tab = TABS.find((t) => t.id === one(params.tab))?.id ?? TABS[0].id;

  return (
    <>
      <nav
        aria-label="Dashboard tabs"
        className="mt-4 flex gap-1 border-b border-secondary/20"
      >
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "overview" ? "/dashboard" : `/dashboard?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 transition-colors ${
              tab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-secondary hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {tab === "database" ? (
        <DatabaseViewLoader
          collection={one(params.collection)}
          page={Number(one(params.page)) || 1}
          query={{
            q: one(params.q) ?? "",
            view: one(params.view) === "sql" ? "sql" : "mongo",
            // f.<field>=<value>; empty means "Any".
            filters: Object.fromEntries(
              Object.entries(params)
                .filter(([k]) => k.startsWith("f."))
                .map(([k, v]) => [k.slice(2), one(v) ?? ""])
                .filter(([, v]) => v !== ""),
            ),
          }}
        />
      ) : tab === "curriculum" ? (
        <CurriculumLoader />
      ) : tab === "senseis" ? (
        <SenseisLoader />
      ) : (
        <Dashboard />
      )}
    </>
  );
}

// Names and emails. Only the manager account can add/remove.
async function SenseisLoader() {
  await connection();
  const session = await auth();
  const senseis = await senseisCollection()
    .find(
      {},
      { projection: { _id: 0, id: 1, first_name: 1, last_name: 1, email: 1 } },
    )
    .sort({ last_name: 1, first_name: 1 })
    .toArray();
  return (
    <SenseisPanel
      senseis={senseis}
      canManage={session?.user.account === "manager"}
    />
  );
}

async function CurriculumLoader() {
  await connection();
  return (
    <CurriculumJourney
      belts={await getCurriculum()}
      beltInfo={await getBelts()}
    />
  );
}

async function DatabaseViewLoader(props: {
  collection?: string;
  page: number;
  query: DbQuery;
}) {
  await connection();
  return <DatabaseView {...props} />;
}

// Reads MongoDB per request so the numbers are current.
async function Dashboard() {
  await connection();
  const today = todayInPacific();
  const students = await getAllStudents();
  const d = buildDashboard({
    today,
    students,
    belts: await getBelts(),
    todaysHours: (await getSessionForDate(today, students)).hours,
    history: Object.values(await getSessionHistory()).flat(),
  });

  const programTotal = d.byProgram.reduce((n, s) => n + s.value, 0);

  return (
    <>
      <p className="mt-4 text-secondary">{today}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total students"
          value={d.totalStudents.toLocaleString("en-US")}
        />
        <StatTile
          label="Checked in today"
          value={d.checkedInToday.toLocaleString("en-US")}
        />
        <StatTile
          label="Avg sessions per week"
          value={d.averageSessionsPerWeek.toLocaleString("en-US")}
        />
        <StatTile
          label="Sessions, last 30 days"
          value={d.sessionsLast30Days.toLocaleString("en-US")}
        />
      </div>

      {/* Pie gets about a third of the row; the belt chart gets the rest. */}
      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr]">
        <ChartCard
          title="Students by program"
          table={{
            headers: ["Program", "Students", "Share"],
            rows: d.byProgram.map((s) => [
              s.label,
              s.value,
              `${programTotal ? Math.round((s.value / programTotal) * 100) : 0}%`,
            ]),
          }}
        >
          <PieChart data={d.byProgram} />
        </ChartCard>

        <ChartCard
          title="Students by belt"
          table={{
            headers: ["Belt", "Students"],
            rows: d.byBelt.map((b) => [b.label, b.value]),
          }}
        >
          <ColumnChart
            data={d.byBelt}
            unit={["student", "students"]}
            angledLabels
          />
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Attendance this week"
          subtitle="Check-ins per day, Monday to Sunday"
          table={{
            headers: ["Day", "Check-ins"],
            rows: d.attendanceThisWeek.map((b) => [b.label, b.value]),
          }}
        >
          <ColumnChart
            data={d.attendanceThisWeek}
            unit={["check-in", "check-ins"]}
            color={PURPLE}
            barWidth={40}
          />
        </ChartCard>

        <ChartCard
          title="Sessions per week"
          subtitle="Total check-ins, by week starting Monday"
          table={{
            headers: ["Week of", "Sessions"],
            rows: d.sessionsByWeek.map((b) => [b.label, b.value]),
          }}
        >
          <ColumnChart data={d.sessionsByWeek} unit={["session", "sessions"]} />
        </ChartCard>
      </div>
    </>
  );
}
