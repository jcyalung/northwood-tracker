// Student tags (e.g. "Needs Attention"). A student can have several, and a
// tag can expire (the old system tied some, like "Coming From Break", to a
// session).
export type StudentTag = {
  name: string;
  // ISO timestamp; null or missing means it doesn't expire.
  expires_at?: string | null;
};

// Names of a student's tags that haven't expired. Also reads the older
// single `label` field from early example data.
export function activeTags(
  student: { tags?: StudentTag[]; label?: string },
  now = Date.now(),
): string[] {
  const names = (student.tags ?? [])
    .filter((t) => !t.expires_at || Date.parse(t.expires_at) > now)
    .map((t) => t.name);
  if (student.label && !names.includes(student.label))
    names.push(student.label);
  return names;
}
