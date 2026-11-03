import type { Instrumentation } from "next";

// Logs the server starting, and any error a page, route, or action throws
// (Dashboard → Logs). Node.js only; the code is in lib/instrumentation-node.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    (await import("@/lib/instrumentation-node")).register();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  ...args
) => {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await (await import("@/lib/instrumentation-node")).onRequestError(...args);
  }
};
