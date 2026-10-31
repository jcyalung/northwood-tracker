import Link from "next/link";
import type { Filter, Document } from "mongodb";
import { DB_NAME, db } from "@/lib/mongodb";
import { DocumentList, type DocValue } from "./document-list";
import { FilterForm } from "./filter-form";
import { SqlTable } from "./sql-table";

const PAGE_SIZE = 20;
const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";

// Search text, field filters, and display mode, from the URL
// (?q=…&f.<field>=…&view=sql).
export type DbQuery = {
  q: string;
  filters: Record<string, string>;
  view: "mongo" | "sql";
};

// URL for the Database tab with this query, optionally changed.
function dbHref(
  collection: string,
  query: DbQuery,
  changes: { page?: number; view?: DbQuery["view"] } = {},
) {
  const params = new URLSearchParams({ tab: "database", collection });
  if (query.q) params.set("q", query.q);
  for (const [path, value] of Object.entries(query.filters)) {
    params.set(`f.${path}`, value);
  }
  if ((changes.view ?? query.view) === "sql") params.set("view", "sql");
  if (changes.page && changes.page > 1)
    params.set("page", String(changes.page));
  return `/dashboard?${params}`;
}

// A field with only a few distinct, short values gets a filter dropdown;
// free text (like notes) is searchable instead.
const MAX_FILTER_VALUES = 20;
const MAX_FILTER_VALUE_LENGTH = 30;
// How many documents to sample when working out a collection's fields.
const SAMPLE_SIZE = 200;

type Scalar = string | number | boolean | null;
type FieldInfo = {
  searchable: string[];
  filterable: { path: string; values: Scalar[] }[];
  hasStudent: boolean;
};

// Read-only view of the connected MongoDB database, styled after MongoDB
// Compass: its collections with counts, search and filters for the open
// collection, and its documents as a paged list.
export async function DatabaseView({
  collection,
  page,
  query,
}: {
  collection?: string;
  page: number;
  query: DbQuery;
}) {
  const collections = await Promise.all(
    (await db.listCollections({}, { nameOnly: true }).toArray())
      .map((c) => c.name)
      .sort()
      .map(async (name) => ({
        name,
        count: await db.collection(name).estimatedDocumentCount(),
      })),
  );
  // Only collections that exist can be opened.
  const selected =
    collections.find((c) => c.name === collection) ?? collections[0];
  const fields = selected ? await describeFields(selected.name) : null;
  const filter = fields ? await buildFilter(fields, query) : {};
  const active = Object.keys(filter).length > 0;
  const total = !selected
    ? 0
    : active
      ? await db.collection(selected.name).countDocuments(filter)
      : selected.count;

  return (
    // On wide screens the view runs past the page column to the window's
    // right edge (less a small gutter); the left edge stays aligned.
    <div className="mt-6 grid items-start gap-4 lg:mr-[calc(50%-50vw+1.5rem)] lg:grid-cols-[16rem_1fr]">
      <aside className="flex flex-col gap-6 rounded-lg border border-secondary/20 bg-surface p-6">
        <div>
          <p className={LABEL}>Database</p>
          <p className="mt-1 break-all font-mono text-base font-semibold text-[#001E2B]">
            {DB_NAME}
          </p>
        </div>
        <div>
          <p className={LABEL}>Collections</p>
          {collections.length === 0 ? (
            <p className="mt-2 text-secondary">No collections yet.</p>
          ) : (
            <ul className="mt-2 flex flex-col gap-1">
              {collections.map((c) => (
                <li key={c.name}>
                  <Link
                    // Switching collections keeps the view, not the filters.
                    href={dbHref(c.name, {
                      q: "",
                      filters: {},
                      view: query.view,
                    })}
                    aria-current={
                      c.name === selected?.name ? "page" : undefined
                    }
                    className={`flex items-baseline justify-between gap-3 rounded-md px-3 py-1.5 transition-colors hover:bg-neutral ${
                      c.name === selected?.name ? "bg-neutral" : ""
                    }`}
                  >
                    <span className="truncate font-mono text-sm text-[#001E2B]">
                      {c.name}
                    </span>
                    <span className="text-sm text-secondary tabular-nums">
                      {c.count.toLocaleString("en-US")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {selected && fields && (
          <FilterSidebar
            collection={selected.name}
            fields={fields}
            query={query}
            active={active}
          />
        )}
      </aside>

      {selected && (
        <CollectionTable
          name={selected.name}
          total={total}
          page={page}
          filter={filter}
          query={query}
        />
      )}
    </div>
  );
}

function FilterSidebar({
  collection,
  fields,
  query,
  active,
}: {
  collection: string;
  fields: FieldInfo;
  query: DbQuery;
  active: boolean;
}) {
  const input =
    "w-full rounded-md border border-secondary/40 bg-surface px-3 py-1.5 font-mono text-sm text-[#001E2B] focus:border-primary focus:outline-none";
  return (
    <FilterForm>
      <input type="hidden" name="tab" value="database" />
      <input type="hidden" name="collection" value={collection} />
      {query.view === "sql" && <input type="hidden" name="view" value="sql" />}
      <label className="flex flex-col gap-2">
        <span className={LABEL}>Search</span>
        <input
          type="search"
          name="q"
          defaultValue={query.q}
          placeholder={
            fields.hasStudent ? "Text or student name" : "Any text field"
          }
          className={input}
        />
      </label>

      {fields.filterable.length > 0 && (
        <fieldset className="flex flex-col gap-3">
          <legend className={`${LABEL} mb-2`}>Filters</legend>
          {fields.filterable.map(({ path, values }) => (
            <label key={path} className="flex flex-col gap-1">
              <span className="font-mono text-xs text-secondary">{path}</span>
              <select
                name={`f.${path}`}
                defaultValue={query.filters[path] ?? ""}
                className={input}
              >
                <option value="">Any</option>
                {values.map((v) => (
                  <option key={String(v)} value={String(v)}>
                    {v === null ? "null" : String(v)}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          Search
        </button>
        {active && (
          <Link
            href={`/dashboard?tab=database&collection=${encodeURIComponent(collection)}`}
            className="text-sm text-secondary underline underline-offset-2 hover:text-primary"
          >
            Clear
          </Link>
        )}
      </div>
    </FilterForm>
  );
}

// Works out a collection's fields from a sample of its documents: string
// fields are searchable; fields with a few distinct values get filters.
// Nested fields use dot paths (belt.belt_title). IDs are left out.
async function describeFields(name: string): Promise<FieldInfo> {
  const collection = db.collection(name);
  const sample = await collection.find({}).limit(SAMPLE_SIZE).toArray();

  const kinds = new Map<string, Set<string>>();
  const walk = (doc: Document, prefix: string, depth: number) => {
    for (const [key, value] of Object.entries(doc)) {
      if (isIdKey(key)) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (Array.isArray(value)) {
        // Lists of objects (like tags) expose their fields as `tags.name`;
        // MongoDB matches those against any item in the list.
        for (const item of value) {
          if (
            item &&
            typeof item === "object" &&
            !(item instanceof Date) &&
            depth < 2
          ) {
            walk(item, path, depth + 1);
          }
        }
      } else if (
        value &&
        typeof value === "object" &&
        !(value instanceof Date) &&
        depth < 2
      ) {
        walk(value, path, depth + 1);
      } else if (
        value === null ||
        ["string", "number", "boolean"].includes(typeof value)
      ) {
        if (!kinds.has(path)) kinds.set(path, new Set());
        kinds.get(path)!.add(value === null ? "null" : typeof value);
      }
    }
  };
  for (const doc of sample) walk(doc, "", 0);

  const paths = [...kinds.keys()];
  const filterable = (
    await Promise.all(
      paths.map(async (path) => {
        const values = (await collection.distinct(path)) as Scalar[];
        // distinct skips missing fields but includes explicit nulls.
        const sorted = values
          .filter((v) => v === null || typeof v !== "object")
          .sort((a, b) =>
            String(a).localeCompare(String(b), "en", { numeric: true }),
          );
        return { path, values: sorted };
      }),
    )
  ).filter(
    ({ values }) =>
      values.length >= 2 &&
      values.length <= MAX_FILTER_VALUES &&
      values.every((v) => String(v).length <= MAX_FILTER_VALUE_LENGTH),
  );

  return {
    searchable: paths.filter((p) => kinds.get(p)!.has("string")),
    filterable,
    hasStudent: sample.some((d) => typeof d.student_id === "string"),
  };
}

// The MongoDB query for the URL's search text and filters. Filter values are
// matched against the field's real values (so "true" means true, "null"
// means null), and search text is escaped, never used as a pattern.
async function buildFilter(
  fields: FieldInfo,
  query: DbQuery,
): Promise<Filter<Document>> {
  const and: Filter<Document>[] = [];

  for (const { path, values } of fields.filterable) {
    const chosen = query.filters[path];
    if (!chosen) continue;
    const value = values.find((v) => String(v) === chosen);
    if (value !== undefined) and.push({ [path]: value });
  }

  const q = query.q.trim();
  if (q) {
    const pattern = { $regex: escapeRegex(q), $options: "i" };
    const or: Filter<Document>[] = fields.searchable.map((p) => ({
      [p]: pattern,
    }));
    if (fields.hasStudent) {
      // Every word must match the student's first or last name.
      const words = q.split(/\s+/).map(escapeRegex);
      const students = await db
        .collection("students")
        .find(
          {
            $and: words.map((w) => ({
              $or: [
                { first_name: { $regex: w, $options: "i" } },
                { last_name: { $regex: w, $options: "i" } },
              ],
            })),
          },
          { projection: { _id: 0, id: 1 } },
        )
        .toArray();
      if (students.length) {
        or.push({ student_id: { $in: students.map((s) => s.id) } });
      }
    }
    // No text fields to search: match nothing (every document has an _id).
    and.push(or.length ? { $or: or } : { _id: { $exists: false } });
  }

  return and.length === 0 ? {} : and.length === 1 ? and[0] : { $and: and };
}

function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function CollectionTable({
  name,
  total,
  page,
  filter,
  query,
}: {
  name: string;
  total: number;
  page: number;
  filter: Filter<Document>;
  query: DbQuery;
}) {
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(Math.max(1, page), pageCount);
  const docs = await db
    .collection(name)
    .find(filter)
    .sort({ _id: 1 })
    .skip((current - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .toArray();

  // Documents that point at a student show the student's name first.
  const studentIds = [
    ...new Set(
      docs.map((d) => d.student_id).filter((id) => typeof id === "string"),
    ),
  ];
  const studentNames = new Map(
    studentIds.length
      ? (
          await db
            .collection("students")
            .find(
              { id: { $in: studentIds } },
              { projection: { _id: 0, id: 1, first_name: 1, last_name: 1 } },
            )
            .toArray()
        ).map((s) => [s.id, `${s.first_name} ${s.last_name}`])
      : [],
  );
  const shown = docs.map((d) => {
    const plain = toPlain(d) as Record<string, DocValue>;
    return typeof d.student_id === "string"
      ? { student: studentNames.get(d.student_id) ?? null, ...plain }
      : plain;
  });

  const first = (current - 1) * PAGE_SIZE;
  // Paging keeps the search, filters, and view.
  const href = (p: number) => dbHref(name, query, { page: p });
  const filtered = Object.keys(filter).length > 0;

  return (
    <section className="min-w-0 overflow-hidden rounded-lg border border-secondary/20 bg-[#F9FBFA]">
      {/* Toolbar, after Compass: collection, count, and paging. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8EDEB] bg-white px-5 py-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-mono text-base font-semibold text-[#001E2B]">
            {DB_NAME}.{name}
          </h2>
          <span className="text-sm text-secondary">
            {total.toLocaleString("en-US")} {filtered ? "matching" : ""}{" "}
            documents · read only
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ViewToggle name={name} query={query} />
          <nav
            aria-label="Pagination"
            className="flex items-center gap-2 font-mono text-sm text-[#001E2B]"
          >
            <span className="text-secondary">
              {total === 0
                ? "0 of 0"
                : `${first + 1} – ${first + docs.length} of ${total.toLocaleString("en-US")}`}
            </span>
            <PageLink
              href={href(current - 1)}
              disabled={current === 1}
              label="Previous page"
            >
              ‹
            </PageLink>
            <PageLink
              href={href(current + 1)}
              disabled={current === pageCount}
              label="Next page"
            >
              ›
            </PageLink>
          </nav>
        </div>
      </div>

      {docs.length === 0 ? (
        <p className="px-5 py-6 text-secondary">
          {filtered
            ? "No documents match this search and these filters."
            : "This collection is empty."}
        </p>
      ) : query.view === "sql" ? (
        <SqlTable docs={shown} firstRow={first + 1} />
      ) : (
        <DocumentList docs={shown} />
      )}
    </section>
  );
}

// MongoDB | SQL switch, after Compass's view toggle.
function ViewToggle({ name, query }: { name: string; query: DbQuery }) {
  const options = [
    { view: "mongo", label: "MongoDB" },
    { view: "sql", label: "SQL" },
  ] as const;
  return (
    <nav
      aria-label="View"
      className="flex rounded-md border border-[#E8EDEB] p-0.5 font-mono text-xs"
    >
      {options.map((o) => (
        <Link
          key={o.view}
          href={dbHref(name, query, { view: o.view })}
          aria-current={query.view === o.view ? "page" : undefined}
          className={`rounded px-2.5 py-1 transition-colors ${
            query.view === o.view
              ? "bg-[#001E2B] text-white"
              : "text-[#5C6C75] hover:text-[#001E2B]"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "flex size-7 items-center justify-center rounded-md border border-[#E8EDEB] text-base";
  return disabled ? (
    <span
      aria-disabled="true"
      aria-label={label}
      className={`${className} opacity-40`}
    >
      {children}
    </span>
  ) : (
    <Link
      href={href}
      aria-label={label}
      className={`${className} bg-white hover:border-[#001E2B]`}
    >
      {children}
    </Link>
  );
}

// `_id`, `id`, and anything ending in `_id` (legacy_id, belt_id, …).
function isIdKey(key: string) {
  return key === "_id" || key === "id" || key.endsWith("_id");
}

// A stored value as plain JSON for the client: ID fields removed at every
// level, dates tagged, other BSON types (ObjectId, …) as strings.
function toPlain(value: unknown): DocValue {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return { $date: value.toISOString() };
  if (Array.isArray(value)) return value.map(toPlain);
  if (typeof value === "object") {
    if ("toHexString" in value && typeof value.toHexString === "function") {
      return value.toHexString();
    }
    return Object.fromEntries(
      Object.entries(value)
        .filter(([k]) => !isIdKey(k))
        .map(([k, v]) => [k, toPlain(v)]),
    );
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}
