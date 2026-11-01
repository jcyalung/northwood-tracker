import { createHash } from "node:crypto";
import { auth } from "@/auth";
import { todayInPacific } from "@/lib/sessions";
import { sessionNotesCollection, studentsCollection } from "@/lib/students";

// Today's check-ins and notes, plus the checked-in students, for Students
// Today's live updates. Polled every few seconds, so it's kept small: two
// indexed queries, and a 304 (no body) when nothing changed since the last
// poll (ETag).
export async function GET(request: Request) {
  if (!(await auth())) return new Response("Not signed in", { status: 401 });

  const date = todayInPacific();
  const notes = await sessionNotesCollection()
    .find({ session_date: date }, { projection: { _id: 0 } })
    // Check-in order: _id is set when the note is created at check-in, and
    // (unlike last_edited) doesn't change when notes are saved.
    .sort({ _id: 1 })
    .toArray();
  const students = notes.length
    ? await studentsCollection()
        .find(
          { id: { $in: notes.map((n) => n.student_id) } },
          { projection: { _id: 0 } },
        )
        .toArray()
    : [];

  const body = JSON.stringify({ date, notes, students });
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }
  return new Response(body, {
    headers: {
      "Content-Type": "application/json",
      ETag: etag,
      "Cache-Control": "no-store",
    },
  });
}
