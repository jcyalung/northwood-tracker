// Loads purchases from purchases.py's output: matches each sheet name to a
// student (by name, letters only; a repeated name is matched by belt) and
// stores one purchase per item with its quantity and date_purchased = null.
// Replaces only undated purchases, so Star Store purchases are kept.
// Dry run unless --write.
//
// Usage: node --env-file=.env scripts/migrate/purchases.mjs <out.json> <database> [--write]
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

const [file, dbName, flag] = process.argv.slice(2);
if (!file || !dbName) {
  console.error("Usage: purchases.mjs <out.json> <database> [--write]");
  process.exit(1);
}
const write = flag === "--write";
const { aliases, by_name } = JSON.parse(await readFile(file, "utf8"));
const nameKey = (name) => name.toLowerCase().replace(/[^a-z]/g, "");

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  const db = client.db(dbName);
  const students = await db
    .collection("students")
    .find({}, { projection: { _id: 0, id: 1, first_name: 1, last_name: 1, belt: 1 } })
    .toArray();

  const purchases = [];
  const ambiguous = [];
  let matched = 0;
  for (const s of students) {
    const key = nameKey(`${s.first_name} ${s.last_name}`);
    let entries = by_name[aliases[key] ?? key] ?? [];
    if (entries.length > 1) {
      entries = entries.filter((e) => e.belt === s.belt.belt_title);
    }
    if (entries.length > 1) {
      ambiguous.push(`${s.first_name} ${s.last_name}`);
      continue;
    }
    if (!entries.length) continue;
    matched++;
    for (const item of entries[0].items) {
      purchases.push({
        student_id: s.id,
        date_purchased: null,
        ...item,
      });
    }
  }

  console.log(
    `${write ? "WRITING" : "DRY RUN"} -> "${dbName}": ${purchases.length} purchases for ${matched} students` +
      (ambiguous.length ? `; skipped (name repeated, belt didn't settle it): ${ambiguous.join(", ")}` : ""),
  );
  if (write) {
    const col = db.collection("purchases");
    const removed = await col.deleteMany({ date_purchased: null });
    if (purchases.length) await col.insertMany(purchases);
    await col.createIndex({ student_id: 1, date_purchased: -1 });
    console.log(`  replaced ${removed.deletedCount} undated purchases; Star Store purchases kept.`);
  }
} finally {
  await client.close();
}
