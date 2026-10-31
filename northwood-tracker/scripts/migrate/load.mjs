// Loads the output of transform.py or curriculum.py into a MongoDB database.
// Each collection in the file ({ students: [...], belt_paths: [...] }) is
// replaced; collections not in the file are left alone. Dry run unless --write.
//
// Usage: node --env-file=.env scripts/migrate/load.mjs <out.json> <database> [--write]
import { readFile } from "node:fs/promises";
import { MongoClient } from "mongodb";

// Indexes per collection: [keys, options].
const INDEXES = {
  students: [
    [{ id: 1 }, { unique: true }],
    [{ legacy_id: 1 }, { unique: true, sparse: true }],
  ],
  session_notes: [
    [{ session_id: 1 }, { unique: true }],
    // One check-in per student per day.
    [{ student_id: 1, session_date: -1 }, { unique: true }],
  ],
  belt_paths: [[{ belt_id: 1, belt_level: 1 }, { unique: true }]],
  belts: [[{ belt_id: 1 }, { unique: true }]],
};

const [file, dbName, flag] = process.argv.slice(2);
if (!file || !dbName) {
  console.error("Usage: load.mjs <out.json> <database> [--write]");
  process.exit(1);
}
const write = flag === "--write";
const data = JSON.parse(await readFile(file, "utf8"));

const client = new MongoClient(process.env.MONGODB_CONN);
try {
  const db = client.db(dbName);
  console.log(`${write ? "WRITING" : "DRY RUN"} -> database "${dbName}"`);
  for (const [name, docs] of Object.entries(data)) {
    const existing = await db.collection(name).countDocuments();
    console.log(`  ${name}: ${existing} now -> ${docs.length} (replaced)`);
    if (!write) continue;
    await db.collection(name).deleteMany({});
    // Old indexes may differ from the ones below; the data is being
    // replaced, so start the indexes over too.
    if ((await db.listCollections({ name }).toArray()).length) {
      await db.collection(name).dropIndexes();
    }
    if (docs.length) await db.collection(name).insertMany(docs);
    for (const [keys, options] of INDEXES[name] ?? []) {
      await db.collection(name).createIndex(keys, options);
    }
  }
  if (write) console.log("  done.");
} finally {
  await client.close();
}
