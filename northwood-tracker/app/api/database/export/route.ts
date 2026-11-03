import { auth } from "@/auth";
import { DB_NAME, db } from "@/lib/mongodb";
import { todayInPacific } from "@/lib/sessions";

// Password hashes stay on the Pi.
const SKIP = new Set(["accounts"]);

// The whole database as one JSON download, for the manager only:
// { "<collection>": [documents], ... }, without MongoDB's _id (the app uses
// its own ids). Same shape scripts/migrate/load.mjs loads, so it can be
// restored with: node --env-file=.env scripts/migrate/load.mjs <file> <db> --write
export async function GET() {
  const session = await auth();
  if (!session) return new Response("Not signed in", { status: 401 });
  if (session.user.account !== "manager") {
    return new Response("Only the manager can export the database", {
      status: 403,
    });
  }

  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((name) => !SKIP.has(name) && !name.startsWith("system."))
    .sort();
  const data: Record<string, unknown[]> = {};
  for (const name of names) {
    data[name] = await db
      .collection(name)
      .find({}, { projection: { _id: 0 } })
      .toArray();
  }

  const date = todayInPacific().replace(/\//g, "-");
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${DB_NAME}-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
