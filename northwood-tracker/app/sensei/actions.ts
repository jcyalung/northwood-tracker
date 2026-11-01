"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SENSEI_COOKIE } from "@/lib/current-sensei";
import { senseisCollection } from "@/lib/senseis";

// The central account says which sensei is using it in this browser.
export async function pickSensei(id: string) {
  const session = await auth();
  if (session?.user.account !== "central") redirect("/");
  if (!(await senseisCollection().countDocuments({ id }, { limit: 1 }))) {
    redirect("/sensei");
  }
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
  (await cookies()).delete(SENSEI_COOKIE);
  redirect("/sensei");
}
