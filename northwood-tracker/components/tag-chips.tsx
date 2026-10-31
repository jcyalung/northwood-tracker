import { activeTags, type StudentTag } from "@/lib/tags";

// Tag colors: blue for Coming From Break, red for Needs Attention, yellow for
// Easily Distracted. Light tints with dark text so each stays readable.
const TAG_STYLES: Record<string, string> = {
  "Coming From Break": "border-blue-300 bg-blue-100 text-blue-900",
  "Needs Attention": "border-red-300 bg-red-100 text-red-900",
  "Easily Distracted": "border-yellow-400 bg-yellow-100 text-yellow-900",
};
const OTHER_STYLE = "border-secondary/40 bg-neutral text-primary";

// A student's active (unexpired) tags as colored pills; nothing if none.
export function TagChips({
  student,
  className = "",
}: {
  student: { tags?: StudentTag[]; label?: string };
  className?: string;
}) {
  const tags = activeTags(student);
  if (tags.length === 0) return null;
  return (
    <span className={`inline-flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-xs leading-tight ${
            TAG_STYLES[tag] ?? OTHER_STYLE
          }`}
        >
          {tag}
        </span>
      ))}
    </span>
  );
}
