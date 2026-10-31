import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_CONN;
if (!uri) throw new Error("MONGODB_CONN is not set");

// Reuse one client across hot reloads in dev so connections don't pile up.
const globalForMongo = globalThis as unknown as { mongoClient?: MongoClient };

const client = globalForMongo.mongoClient ?? new MongoClient(uri);
if (process.env.NODE_ENV !== "production") globalForMongo.mongoClient = client;

// MONGODB_DB picks the database, e.g. northwood_example for the migrated
// export. Defaults to northwood.
export const DB_NAME = process.env.MONGODB_DB || "northwood";
export const db = client.db(DB_NAME);
