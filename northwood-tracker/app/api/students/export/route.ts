import { auth } from "@/auth";
import { capitalize } from "@/lib/belts";
import { activeTags } from "@/lib/tags";
import { toCsv } from "@/lib/csv";
import { todayInPacific } from "@/lib/sessions";
import { getAllStudents } from "@/lib/students";

const HEADERS = [
  "Last Name",
  "First Name",
  "Program",
  "Belt",
  "Level",
  "Type",
  "Current Activity",
  "Last Session",
  "Parent Email",
  "Birthday",
  "Debrief Method",
  "Tags",
  "Stars",
  "Notes",
];

// Every student as a CSV download, sorted by last name.
export async function GET() {
  if (!(await auth())) {
    return new Response("Not signed in", { status: 401 });
  }

  const students = (await getAllStudents()).sort(
    (a, b) =>
      a.last_name.localeCompare(b.last_name) ||
      a.first_name.localeCompare(b.first_name),
  );

  const csv = toCsv(
    HEADERS,
    students.map((s) => [
      s.last_name,
      s.first_name,
      s.program,
      capitalize(s.belt.belt_title),
      s.belt.belt_level,
      s.belt.belt_type && capitalize(s.belt.belt_type),
      s.current_activity?.title,
      s.last_session,
      s.parent_email,
      s.birthday,
      s.debrief_method,
      activeTags(s).join("; "),
      s.stars,
      s.notes,
    ]),
  );

  const date = todayInPacific().replace(/\//g, "-");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="northwood-students-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
