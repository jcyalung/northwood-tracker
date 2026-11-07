import { spawn } from "node:child_process";
import path from "node:path";
import { log } from "@/lib/logs";

// Runs scripts/backup.mjs (database + attendance to data-backup/, then
// Google Drive) in the background, e.g. after Save Day. The result goes to
// Dashboard → Logs. Presses while one is running are combined into one more
// run afterwards, so the backup always ends up with the latest data.

type State = { running: boolean; again: { by?: string } | null };
const globalForBackup = globalThis as unknown as { northwoodBackup?: State };
const state: State = (globalForBackup.northwoodBackup ??= {
  running: false,
  again: null,
});

export function startBackup(reason: string, by?: string) {
  if (state.running) {
    state.again = { by };
    return;
  }
  state.running = true;
  log("info", "backup", `Backup started (${reason})`, { by });

  // The app's directory, where .env and scripts/ are.
  const child = spawn(
    process.execPath,
    ["--env-file=.env", path.join("scripts", "backup.mjs")],
    { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] },
  );
  const output: string[] = [];
  const keep = (chunk: Buffer) => {
    output.push(...chunk.toString().split("\n").filter(Boolean));
    if (output.length > 50) output.splice(0, output.length - 50);
  };
  child.stdout.on("data", keep);
  child.stderr.on("data", keep);

  const done = (ok: boolean, detail?: string) => {
    state.running = false;
    if (ok) {
      const drive = output.some((l) => l.startsWith("Google Drive: copied"));
      log(
        "info",
        "backup",
        drive
          ? "Backup finished: saved on the Pi and copied to Google Drive"
          : "Backup finished: saved on the Pi (Google Drive isn't set up)",
        { by },
      );
    } else {
      log("error", "backup", "Backup failed", { by, detail });
    }
    if (state.again) {
      const next = state.again;
      state.again = null;
      startBackup("Save Day, again", next.by);
    }
  };
  child.on("error", (error) => done(false, error.message));
  child.on("close", (code) =>
    done(
      code === 0,
      output.findLast((l) => l.startsWith("Backup error:")) ??
        output.at(-1) ??
        `Exited with code ${code}`,
    ),
  );
}
