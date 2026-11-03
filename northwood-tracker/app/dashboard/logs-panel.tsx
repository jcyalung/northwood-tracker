"use client";

import { useEffect, useRef, useState } from "react";
import type { LogCategory, LogEntry, LogLevel, ServerStatus } from "@/lib/logs";
import { TIME_ZONE } from "@/lib/sessions";

const LABEL = "font-label text-xs uppercase tracking-[0.08em] text-secondary";
const POLL_MS = 3000;
// Kept in the browser; older entries drop off.
const MAX_SHOWN = 1000;

const CATEGORIES: { id: LogCategory; label: string }[] = [
  { id: "sign-in", label: "Sign-ins" },
  { id: "sensei", label: "Senseis" },
  { id: "check-in", label: "Check-ins" },
  { id: "debrief", label: "Debriefs" },
  { id: "save-day", label: "Save Day" },
  { id: "save", label: "Failed saves" },
  { id: "database", label: "Database" },
  { id: "server", label: "Server" },
];

const LEVELS: { id: "all" | "warn" | "error"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "warn", label: "Warnings & errors" },
  { id: "error", label: "Errors" },
];

// Info has no color; warnings are amber; errors are red.
const ROW: Record<LogLevel, string> = {
  info: "border-l-transparent",
  warn: "border-l-amber-500 bg-amber-50",
  error: "border-l-red-600 bg-red-50",
};
const BADGE: Record<LogLevel, string> = {
  info: "border border-secondary/40 text-secondary",
  warn: "bg-amber-500 text-white",
  error: "bg-red-600 text-white",
};
const BADGE_TEXT: Record<LogLevel, string> = {
  info: "Info",
  warn: "Warning",
  error: "Error",
};

export function LogsPanel({
  initialEntries,
  initialStatus,
}: {
  initialEntries: LogEntry[];
  initialStatus: ServerStatus;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [status, setStatus] = useState(initialStatus);
  const [live, setLive] = useState(true);
  const [level, setLevel] = useState<(typeof LEVELS)[number]["id"]>("all");
  const [category, setCategory] = useState<LogCategory | "">("");
  // Seconds since the last status came in, so uptime counts up between polls.
  const [elapsed, setElapsed] = useState(0);
  const receivedAt = useRef<number | null>(null);
  const lastId = useRef(initialEntries.at(-1)?.id ?? 0);
  const boot = useRef(initialStatus.boot);

  useEffect(() => {
    receivedAt.current = performance.now();
    const timer = setInterval(() => {
      if (receivedAt.current !== null) {
        setElapsed(Math.floor((performance.now() - receivedAt.current) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let inFlight = false;
    async function poll() {
      if (inFlight || document.visibilityState !== "visible") return;
      inFlight = true;
      try {
        const response = await fetch(`/api/logs?after=${lastId.current}`, {
          cache: "no-store",
        });
        if (
          !response.ok ||
          !response.headers.get("Content-Type")?.includes("json")
        ) {
          return;
        }
        const data: { entries: LogEntry[]; status: ServerStatus } =
          await response.json();
        // The app restarted: its log starts over.
        const restarted = data.status.boot !== boot.current;
        boot.current = data.status.boot;
        if (restarted || data.entries.length) {
          setEntries((current) =>
            (restarted ? data.entries : [...current, ...data.entries]).slice(
              -MAX_SHOWN,
            ),
          );
        }
        if (data.entries.length) lastId.current = data.entries.at(-1)!.id;
        else if (restarted) lastId.current = 0;
        setStatus(data.status);
        receivedAt.current = performance.now();
        setElapsed(0);
      } catch {
        // The server is restarting or unreachable: try again next time.
      } finally {
        inFlight = false;
      }
    }
    if (!live) return;
    poll();
    const timer = setInterval(poll, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live]);

  const shown = entries
    .filter(
      (e) =>
        level === "all" ||
        e.level === "error" ||
        (level === "warn" && e.level === "warn"),
    )
    .filter((e) => !category || e.category === category)
    .reverse();

  return (
    <div className="mt-6 flex flex-col gap-4">
      <section
        aria-label="Server status"
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Tile
          label="App uptime"
          value={duration(status.appUptime + elapsed)}
        />
        <Tile
          label="Pi uptime"
          value={duration(status.systemUptime + elapsed)}
        />
        <Tile
          label="Database"
          value={status.database === "connected" ? "Connected" : "Unreachable"}
          tone={status.database === "connected" ? undefined : "error"}
        />
        <Tile
          label="Errors since start"
          value={status.errors.toLocaleString("en-US")}
          tone={status.errors ? "error" : undefined}
        />
        <Tile
          label="Warnings since start"
          value={status.warnings.toLocaleString("en-US")}
          tone={status.warnings ? "warn" : undefined}
        />
      </section>

      <section
        aria-label="Log"
        className="rounded-lg border border-secondary/20 bg-surface p-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-xl leading-tight text-primary">
              Activity log
            </h2>
            <p className="text-sm text-secondary">
              Since the app last started. The full history is in{" "}
              <code className="text-xs">journalctl -u northwood</code>.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div
              role="group"
              aria-label="Level"
              className="flex overflow-hidden rounded-md border border-secondary/40"
            >
              {LEVELS.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={level === l.id}
                  onClick={() => setLevel(l.id)}
                  className={`px-3 py-1.5 text-sm transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary ${
                    level === l.id
                      ? "bg-primary text-on-primary"
                      : "text-secondary hover:text-primary"
                  }`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Type</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as LogCategory | "")}
                className="rounded-md border border-secondary/40 bg-surface px-3 py-1.5 text-sm text-primary"
              >
                <option value="">Everything</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              aria-pressed={live}
              onClick={() => setLive(!live)}
              className="flex items-center gap-2 rounded-md border border-secondary/40 px-3 py-1.5 text-sm text-secondary transition-colors hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span
                aria-hidden="true"
                className={`size-2 rounded-full ${live ? "animate-pulse bg-tertiary" : "bg-secondary/40"}`}
              />
              {live ? "Live" : "Paused"}
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <p className="mt-6 text-secondary">Nothing logged yet.</p>
        ) : (
          <ol className="mt-4 flex flex-col">
            {shown.map((e) => (
              <li
                key={e.id}
                className={`grid grid-cols-[7rem_5.5rem_1fr] items-baseline gap-x-3 border-t border-l-4 border-t-secondary/20 px-3 py-2 text-sm ${ROW[e.level]}`}
              >
                <time
                  dateTime={e.time}
                  title={formatTime(e.time, true)}
                  className="tabular-nums text-secondary"
                >
                  {formatTime(e.time)}
                </time>
                <span
                  className={`justify-self-start rounded px-1.5 py-0.5 font-label text-[0.6875rem] uppercase tracking-[0.06em] ${BADGE[e.level]}`}
                >
                  {BADGE_TEXT[e.level]}
                </span>
                <div className="min-w-0">
                  <p
                    className={
                      e.level === "error" ? "text-red-800" : "text-primary"
                    }
                  >
                    <span className="text-secondary">
                      {CATEGORIES.find((c) => c.id === e.category)?.label ??
                        e.category}
                      {" · "}
                    </span>
                    {e.message}
                    {e.by && <span className="text-secondary"> — {e.by}</span>}
                  </p>
                  {e.detail && (
                    <p className="break-words text-xs text-secondary">
                      {e.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "error";
}) {
  return (
    <div
      className={`rounded-lg border px-6 py-4 ${
        tone === "error"
          ? "border-red-300 bg-red-50"
          : tone === "warn"
            ? "border-amber-300 bg-amber-50"
            : "border-secondary/20 bg-surface"
      }`}
    >
      <p className={LABEL}>{label}</p>
      <p
        className={`mt-1 font-display text-[1.75rem] leading-tight ${
          tone === "error"
            ? "text-red-700"
            : tone === "warn"
              ? "text-amber-700"
              : "text-primary"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// "3d 4h 12m", "4h 12m 5s", "12m 5s".
function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d) return `${d}d ${h}h ${m}m`;
  if (h) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

// Pacific time: "4:05:12 PM" today, "Nov 1, 4:05 PM" before.
function formatTime(iso: string, full = false): string {
  const date = new Date(iso);
  const day = (d: Date) =>
    d.toLocaleDateString("en-US", { timeZone: TIME_ZONE });
  if (!full && day(date) === day(new Date())) {
    return date.toLocaleTimeString("en-US", {
      timeZone: TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return date.toLocaleString("en-US", {
    timeZone: TIME_ZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    ...(full && { second: "2-digit", year: "numeric" }),
  });
}
