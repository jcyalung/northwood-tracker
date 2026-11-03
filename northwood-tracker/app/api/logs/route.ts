import { auth } from "@/auth";
import { logsAfter, serverStatus } from "@/lib/logs";
import { db } from "@/lib/mongodb";

// Dashboard → Logs' live updates, for anyone signed in: entries after
// ?after=<id>, plus uptime, database status, and error counts.
export async function GET(request: Request) {
  if (!(await auth())) return new Response("Not signed in", { status: 401 });
  const after = Number(new URL(request.url).searchParams.get("after")) || 0;
  return Response.json(
    {
      entries: logsAfter(after),
      status: await serverStatus(() => db.command({ ping: 1 })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
