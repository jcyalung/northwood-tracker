import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Signed-out users go to /login; signed-in users skip it.
export const proxy = auth((req) => {
  const signedIn = !!req.auth;
  const onLogin = req.nextUrl.pathname === "/login";

  if (!signedIn && !onLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  if (signedIn && onLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
});

export const config = {
  // Skip auth routes, Next internals, and files in public/ (anything with an extension).
  matcher: ["/((?!api/auth|_next/static|_next/image|.*\\..*).*)"],
};
