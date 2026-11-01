import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SENSEI_COOKIE } from "@/lib/current-sensei";

// Signed-out users go to /login; signed-in users skip it. The central
// account picks which sensei it is (/sensei) before anything else.
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const redirect = (path: string) =>
    NextResponse.redirect(new URL(path, req.nextUrl));

  if (!req.auth) return pathname === "/login" ? undefined : redirect("/login");
  if (pathname === "/login") return redirect("/");

  const central = req.auth.user.account === "central";
  const picked = req.cookies.has(SENSEI_COOKIE);
  if (central && !picked && pathname !== "/sensei") return redirect("/sensei");
  if (!central && pathname === "/sensei") return redirect("/");
});

export const config = {
  // Skip auth routes, Next internals, and files in public/ (anything with an extension).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\..*).*)"],
};
