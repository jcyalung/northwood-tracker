import { capitalize, type BeltInfo } from "@/lib/belts";
import { PROGRAMS } from "@/lib/options";
import type { HourGroup, SessionNote, Student } from "@/lib/students";

export type Bar = {
  label: string;
  value: number;
  // Bar color; defaults to the chart's series color.
  color?: string;
};
export type Slice = { label: string; value: number };

export type DashboardData = {
  totalStudents: number;
  checkedInToday: number;
  averageSessionsPerWeek: number;
  sessionsLast30Days: number;
  byProgram: Slice[];
  byBelt: Bar[];
  attendanceThisWeek: Bar[];
  sessionsByWeek: Bar[];
};

// Purple belt's color, also used for the attendance chart.
export const PURPLE = "#893f98";

// A "session" is one student check-in on one day. History comes from Session
// Notes; today's check-ins count too, since they aren't saved as notes yet.
type CheckIn = { date: number; hour: string };

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// How many weeks the sessions-per-week chart shows, ending this week.
const WEEKS_SHOWN = 6;

// Days since 1970-01-01 -> "Oct 12".
function shortDate(dayNum: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(dayNum * 86_400_000));
}

// MM/DD/YYYY -> days since 1970-01-01, so dates compare and subtract simply.
function dayNumber(date: string): number {
  const [m, d, y] = date.split("/").map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

export function buildDashboard({
  today,
  students,
  belts,
  todaysHours,
  history,
}: {
  today: string;
  students: Student[];
  // Every belt, from the `belts` collection (names and colors).
  belts: BeltInfo[];
  todaysHours: HourGroup[];
  history: SessionNote[];
}): DashboardData {
  const todayNum = dayNumber(today);

  const checkIns: CheckIn[] = [
    ...history
      .filter((note) => dayNumber(note.session_date) < todayNum)
      .map((note) => ({
        date: dayNumber(note.session_date),
        hour: note.session_hour,
      })),
    ...todaysHours.flatMap(({ hour, students: s }) =>
      s.map(() => ({ date: todayNum, hour })),
    ),
  ];
  const within = (days: number) =>
    checkIns.filter((c) => c.date > todayNum - days && c.date <= todayNum);

  // Weeks run Monday to Sunday.
  const weekday = (new Date(todayNum * 86_400_000).getUTCDay() + 6) % 7;
  const monday = todayNum - weekday;
  const thisWeek = checkIns.filter(
    (c) => c.date >= monday && c.date < monday + 7,
  );

  // Programs in a fixed order so each keeps its color; "Not set" only if used.
  const programCounts = PROGRAMS.map((program) => ({
    label: program,
    value: students.filter((s) => s.program === program).length,
  }));
  const unset = students.filter((s) => !s.program).length;

  return {
    totalStudents: students.length,
    checkedInToday: todaysHours.reduce((n, h) => n + h.students.length, 0),
    // Over the last four weeks.
    averageSessionsPerWeek: Math.round((within(28).length / 4) * 10) / 10,
    sessionsLast30Days: within(30).length,
    byProgram: unset
      ? [...programCounts, { label: "Not set", value: unset }]
      : programCounts,
    byBelt: belts.map((b) => ({
      label: capitalize(b.title),
      value: students.filter((s) => s.belt.belt_id === b.belt_id).length,
      color: b.color,
    })),
    attendanceThisWeek: DAY_NAMES.map((label, i) => ({
      label,
      value: thisWeek.filter((c) => c.date === monday + i).length,
    })),
    // Total check-ins per week (Monday to Sunday), oldest first, labeled by
    // the week's Monday.
    sessionsByWeek: Array.from({ length: WEEKS_SHOWN }, (_, i) => {
      const start = monday - (WEEKS_SHOWN - 1 - i) * 7;
      return {
        label: shortDate(start),
        value: checkIns.filter((c) => c.date >= start && c.date < start + 7)
          .length,
      };
    }),
  };
}
