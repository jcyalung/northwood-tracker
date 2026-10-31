"use client";

import type { BeltInfo, BeltPaths } from "@/lib/belts";
import type { SessionNote, Student } from "@/lib/students";
import { StudentCard, type CardHandle } from "./student-card";

// One hour's dropdown, with a count of who's been debriefed.
export function HourSection({
  hour,
  students,
  paths,
  belts,
  notes,
  debriefed,
  onDebriefedChange,
  birthdayIds,
  onUnsavedChange,
  register,
}: {
  hour: string;
  students: Student[];
  paths: BeltPaths;
  belts: BeltInfo[];
  notes: Record<string, SessionNote>;
  debriefed: Record<string, boolean>;
  onDebriefedChange: (studentId: string, debriefed: boolean) => void;
  birthdayIds: Set<string>;
  onUnsavedChange: (studentId: string, unsaved: boolean) => void;
  register: (studentId: string, handle: CardHandle | null) => void;
}) {
  const debriefedCount = students.filter((s) => debriefed[s.id]).length;

  return (
    <details
      open
      className="group rounded-lg border border-secondary/20 bg-surface"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-2xl text-primary">{hour}</span>
        <span className="flex items-center gap-3 font-label text-xs uppercase tracking-[0.08em] text-secondary">
          <span>
            {students.length} {students.length === 1 ? "student" : "students"}
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {debriefedCount}/{students.length} debriefed
          </span>
          <span className="transition-transform group-open:rotate-180">▾</span>
        </span>
      </summary>

      <div className="grid items-start gap-4 px-6 pb-6 md:grid-cols-2">
        {students.length === 0 ? (
          <p className="text-secondary">No students this hour.</p>
        ) : (
          // Two independent columns (students alternate left/right), so
          // minimizing a card only shifts the cards below it.
          [0, 1].map((column) => (
            <div key={column} className="flex flex-col gap-4">
              {students
                .filter((_, i) => i % 2 === column)
                .map((student) => (
                  <StudentCard
                    key={student.id}
                    student={student}
                    paths={paths}
                    belts={belts}
                    note={notes[student.id]}
                    debriefed={debriefed[student.id] ?? false}
                    onDebriefedChange={(checked) =>
                      onDebriefedChange(student.id, checked)
                    }
                    birthday={birthdayIds.has(student.id)}
                    register={(handle) => register(student.id, handle)}
                    onUnsavedChange={(unsaved) =>
                      onUnsavedChange(student.id, unsaved)
                    }
                  />
                ))}
            </div>
          ))
        )}
      </div>
    </details>
  );
}
