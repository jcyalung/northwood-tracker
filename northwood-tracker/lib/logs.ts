import { uptime as systemUptime } from "node:os";

// App activity log for Dashboard → Logs: sign-ins, sensei picks, check-ins,
// debriefs, Save Day, failed saves, and server/database errors. Kept in
// memory (the newest MAX_ENTRIES, cleared when the app restarts) and also
// printed, so `journalctl -u northwood` keeps the full history.

export type LogLevel = "info" | "warn" | "error";
export type LogCategory =
  | "server"
  | "database"
  | "sign-in"
  | "sensei"
  | "check-in"
  | "debrief"
  | "save-day"
  | "save";

export type LogEntry = {
  id: number;
  time: string; // ISO
  level: LogLevel;
  category: LogCategory;
  message: string;
  // Who did it: "Manager", the sensei on the center account, or "Center".
  by?: string;
  detail?: string;
};

export type ServerStatus = {
  // Changes when the app restarts (log ids start over).
  boot: string;
  appUptime: number; // seconds
  systemUptime: number; // seconds
  database: "connected" | "unreachable";
  errors: number; // since the app started
  warnings: number;
};

const MAX_ENTRIES = 1000;

type Store = {
  boot: string;
  entries: LogEntry[];
  nextId: number;
  errors: number;
  warnings: number;
};

// On globalThis so every bundle (pages, actions, instrumentation) shares one.
const globalForLogs = globalThis as unknown as { northwoodLogs?: Store };
const store: Store = (globalForLogs.northwoodLogs ??= {
  boot: String(Date.now()),
  entries: [],
  nextId: 1,
  errors: 0,
  warnings: 0,
});

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  extra: { by?: string; detail?: string } = {},
) {
  const entry: LogEntry = {
    id: store.nextId++,
    time: new Date().toISOString(),
    level,
    category,
    message,
    ...(extra.by && { by: extra.by }),
    ...(extra.detail && { detail: extra.detail }),
  };
  store.entries.push(entry);
  if (store.entries.length > MAX_ENTRIES) store.entries.shift();
  if (level === "error") store.errors++;
  if (level === "warn") store.warnings++;

  const line = [
    `[${level}] [${category}]`,
    message,
    entry.by && `(by ${entry.by})`,
    entry.detail && `- ${entry.detail}`,
  ]
    .filter(Boolean)
    .join(" ");
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

// Entries newer than `after` (an entry id), oldest first.
export function logsAfter(after = 0): LogEntry[] {
  return store.entries.filter((e) => e.id > after);
}

export function isDatabaseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name.startsWith("Mongo") || error.constructor.name.startsWith("Mongo"))
  );
}

// Logs an unexpected error as a database error or a server error.
export function logError(
  error: unknown,
  where: string,
  by?: string,
) {
  const db = isDatabaseError(error);
  const message = error instanceof Error ? error.message : String(error);
  log("error", db ? "database" : "server", db ? `Database error: ${message}` : message, {
    by,
    detail: where,
  });
}

// Logs a failed save (an action that returned { ok: false }), then returns
// the result unchanged.
export function logIfFailed<T extends { ok: boolean }>(
  what: string,
  result: T,
  by?: string,
): T {
  if (!result.ok) {
    const error = (result as { error?: unknown }).error;
    const conflict = (result as { conflict?: unknown }).conflict;
    log("warn", "save", `Couldn't save: ${what}`, {
      by,
      detail:
        typeof error === "string"
          ? error
          : conflict
            ? "Someone else saved changes first"
            : undefined,
    });
  }
  return result;
}

export async function serverStatus(
  pingDatabase: () => Promise<unknown>,
): Promise<ServerStatus> {
  let database: ServerStatus["database"] = "unreachable";
  try {
    // Don't wait out MongoDB's 30-second server selection.
    await Promise.race([
      pingDatabase(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 2000),
      ),
    ]);
    database = "connected";
  } catch {}
  return {
    boot: store.boot,
    appUptime: Math.floor(process.uptime()),
    systemUptime: Math.floor(systemUptime()),
    database,
    errors: store.errors,
    warnings: store.warnings,
  };
}
