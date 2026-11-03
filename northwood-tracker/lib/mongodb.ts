import { MongoClient } from "mongodb";
import { log } from "@/lib/logs";

const uri = process.env.MONGODB_CONN;
if (!uri) throw new Error("MONGODB_CONN is not set");

// Reuse one client across hot reloads in dev so connections don't pile up.
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

const client = globalForMongo.mongoClient ?? new MongoClient(uri);
if (process.env.NODE_ENV !== "production") globalForMongo.mongoClient = client;

// Logs when the connection to MongoDB drops and comes back (the driver
// checks it every 10 seconds). Once per client, even across hot reloads.
const watched = client as MongoClient & { northwoodWatched?: boolean };
if (!watched.northwoodWatched) {
  watched.northwoodWatched = true;
  let up = true;
  client.on("serverHeartbeatFailed", (event) => {
    if (!up) return;
    up = false;
    log("error", "database", "Lost the connection to the database", {
      detail: event.failure?.message,
    });
  });
  client.on("serverHeartbeatSucceeded", () => {
    if (up) return;
    up = true;
    log("info", "database", "Database connection restored");
  });
}

// MONGODB_DB picks the database, e.g. northwood_example for the migrated
// export. Defaults to northwood.
export const DB_NAME = process.env.MONGODB_DB || "northwood";
export const db = client.db(DB_NAME);
