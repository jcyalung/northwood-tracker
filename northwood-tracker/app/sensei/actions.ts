"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { logActor, SENSEI_COOKIE } from "@/lib/current-sensei";
import { log } from "@/lib/logs";
import { senseisCollection } from "@/lib/senseis";

// The central account says which sensei is using it in this browser.
export async function pickSensei(id: string) {
  const session = await auth();
  if (session?.user.account !== "central") redirect("/");
  const sensei = await senseisCollection().findOne(
    { id },
    { projection: { _id: 0, first_name: 1, last_name: 1 } },
  );
  if (!sensei) redirect("/sensei");
  log("info", "sensei", "Picked who's using the center account", {
    by: `${sensei.first_name} ${sensei.last_name}`,
  });
  // No maxAge: ends with the browser session, and on sign out.
  (await cookies()).set(SENSEI_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  redirect("/");
}

// Hands the central account to a different sensei.
export async function switchSensei() {
  log("info", "sensei", "Switched sensei", {
    by: await logActor(await auth()),
  });
  (await cookies()).delete(SENSEI_COOKIE);
  redirect("/sensei");
}

// Signs out of either account (and forgets the picked sensei).
export async function signOutAction() {
  const session = await auth();
  if (session) {
    log("info", "sign-in", "Signed out", { by: await logActor(session) });
  }
  (await cookies()).delete(SENSEI_COOKIE);
  await signOut({ redirectTo: "/login" });
}
