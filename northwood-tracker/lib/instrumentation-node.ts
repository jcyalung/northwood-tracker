import type { Instrumentation } from "next";
import { log, logError } from "@/lib/logs";

// Node.js half of instrumentation.ts (kept out of the Edge build).
export function register() {
  log("info", "server", "Server started", {
    detail: `Node ${process.version}`,
  });
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  request,
  context,
) => {
  const kind =
    context.routeType === "action"
      ? "action"
      : context.routeType === "route"
        ? "API"
        : context.routeType === "proxy"
          ? "proxy"
          : "page";
  logError(error, `${request.method} ${request.path} (${kind})`);
};
