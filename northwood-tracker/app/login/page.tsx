import type { Metadata } from "next";
import { Suspense } from "react";
import { EmailSignIn } from "./email-sign-in";

export const metadata: Metadata = {
  title: "Sign In · Northwood Tracker",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-neutral px-4">
      <div className="w-full max-w-sm rounded-lg border border-secondary/20 bg-surface p-6 text-primary">
        <p className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
          Code Ninjas Northwood
        </p>
        <h1 className="mt-2 font-display text-[3.125rem] leading-tight">
          Sign in
        </h1>
        <p className="mt-2 text-secondary">
          Sign in with the center account. You&apos;ll pick your name next.
        </p>

        <Suspense>
          <SignInError searchParams={searchParams} />
        </Suspense>

        <div className="mt-6">
          <EmailSignIn />
        </div>
      </div>
    </main>
  );
}

// Auth.js redirects back here with ?error=... when sign-in fails or is denied.
async function SignInError({
  searchParams,
}: {
  searchParams: PageProps<"/login">["searchParams"];
}) {
  const { error } = await searchParams;
  if (!error) return null;

  return (
    <p
      role="alert"
      className="mt-4 rounded-md border border-secondary/40 px-3 py-2 text-sm"
    >
      Something went wrong signing in. Please try again.
    </p>
  );
}
