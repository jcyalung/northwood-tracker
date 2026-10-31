// The center runs on Pacific time, whatever time zone the server is in.
// America/Los_Angeles handles the PST/PDT switch.
export const TIME_ZONE = "America/Los_Angeles";

// Today's date in Pacific time as MM/DD/YYYY. Pages must call
// `await connection()` first so this runs per request, not at build time.
export function todayInPacific(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

// Check-in hours (see sessions.md): Mon–Fri sessions run 2–6 PM and Sat/Sun
// 1–5 PM, so students can be checked in at 2–5 PM or 1–4 PM.
export function sessionHours(date: string): string[] {
  const [month, day, year] = date.split("/").map(Number);
  // UTC so the weekday doesn't depend on the server's time zone.
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const start = weekday === 0 || weekday === 6 ? 1 : 2;
  return [0, 1, 2, 3].map((i) => `${start + i} PM`);
}

// Whether `birthday` (MM/DD/YYYY) falls on `today` (MM/DD/YYYY). Feb 29
// birthdays are celebrated on Feb 28 in non-leap years. Unknown birthdays
// (null) never match.
export function isBirthday(birthday: string | null, today: string): boolean {
  if (!birthday) return false;
  const [bMonth, bDay] = birthday.split("/").map(Number);
  const [month, day, year] = today.split("/").map(Number);
  if (bMonth === month && bDay === day) return true;
  const leapYear = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  return bMonth === 2 && bDay === 29 && !leapYear && month === 2 && day === 28;
}
