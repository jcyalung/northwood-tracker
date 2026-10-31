import type { DocValue } from "./document-list";
import { ExpandableText } from "./expandable-text";

// Longer text is cut, with See more. Text-heavy columns (notes and the
// like) are wider and show more before cutting.
const MAX_CELL = 60;
const MAX_WIDE_CELL = 160;
const WIDE_AFTER = 40;

// Documents as a plain SQL-style result grid: nested fields flattened into
// dot-path columns (belt.belt_title), numbered rows, NULL in gray.
export function SqlTable({
  docs,
  firstRow,
}: {
  docs: Record<string, DocValue>[];
  // Row number of the first document (for paging).
  firstRow: number;
}) {
  const rows = docs.map(flatten);
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const wide = new Set(
    columns.filter((c) =>
      rows.some((r) => typeof r[c] === "string" && r[c].length > WIDE_AFTER),
    ),
  );

  return (
    // Inset card with a shadow, dark header, and striped rows so the grid
    // stands out from the panel.
    <div className="p-4 font-mono text-[0.8rem]">
      <div className="overflow-x-auto rounded-lg border border-[#C1C7C6] bg-white shadow-[0_2px_8px_rgba(0,30,43,0.12)]">
        <table className="w-full border-collapse text-left">
          <thead className="bg-[#001E2B] text-white">
            <tr>
              <th className="sticky left-0 border-r border-[#3D4F58] bg-[#001E2B] px-3 py-2.5 text-right font-normal text-[#C1C7C6]">
                #
              </th>
              {columns.map((c) => (
                <th
                  key={c}
                  className="whitespace-nowrap border-r border-[#3D4F58] px-3 py-2.5 font-semibold last:border-r-0"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={i}
                className="align-top odd:bg-white even:bg-[#F4F7F6] hover:bg-[#E3FCF7]"
              >
                <td className="sticky left-0 border-b border-r border-[#C1C7C6] bg-inherit px-3 py-2 text-right text-[#5C6C75] tabular-nums">
                  {firstRow + i}
                </td>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={`border-b border-r border-[#E8EDEB] px-3 py-2 text-[#001E2B] last:border-r-0 ${
                      wide.has(c)
                        ? "min-w-[24rem] max-w-[36rem]"
                        : "min-w-[6rem] max-w-[22rem]"
                    }`}
                  >
                    <Cell
                      value={row[c]}
                      limit={wide.has(c) ? MAX_WIDE_CELL : MAX_CELL}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Cell = string | number | boolean | null;

// { belt: { belt_title: "blue" } } -> { "belt.belt_title": "blue" }. Arrays
// become one cell: scalars or item names joined with commas, else JSON.
function flatten(doc: Record<string, DocValue>): Record<string, Cell> {
  const out: Record<string, Cell> = {};
  const walk = (value: DocValue, path: string) => {
    if (value === null || typeof value !== "object") {
      out[path] = value;
    } else if (Array.isArray(value)) {
      // Scalars joined; named items (like tags) by name; anything else JSON.
      out[path] = value.every((v) => v === null || typeof v !== "object")
        ? value.map((v) => String(v)).join(", ")
        : value.every(isNamed)
          ? value.map((v) => v.name).join(", ")
          : JSON.stringify(value);
    } else if ("$date" in value && typeof value.$date === "string") {
      out[path] = value.$date;
    } else {
      for (const [k, v] of Object.entries(value)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  };
  walk(doc, "");
  return out;
}

function isNamed(v: DocValue): v is { name: string } {
  return (
    typeof v === "object" &&
    v !== null &&
    !Array.isArray(v) &&
    typeof (v as Record<string, DocValue>).name === "string"
  );
}

function Cell({ value, limit }: { value: Cell | undefined; limit: number }) {
  if (value === null || value === undefined) {
    return <span className="text-[#5C6C75]">NULL</span>;
  }
  if (typeof value === "number") {
    return <span className="block text-right tabular-nums">{value}</span>;
  }
  if (typeof value === "boolean") return <>{value ? "true" : "false"}</>;
  return <ExpandableText text={value} limit={limit} />;
}
