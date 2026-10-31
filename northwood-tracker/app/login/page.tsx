import type { Metadata } from "next";
import { Suspense } from "react";
import { signIn } from "@/auth";

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
          Use your sensei account to continue.
        </p>

        <Suspense>
          <SignInError searchParams={searchParams} />
        </Suspense>

        <GoogleSignInButton />

        <div className="my-6 flex items-center gap-4">
          <span className="h-px flex-1 bg-secondary/20" />
          <span className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
            or
          </span>
          <span className="h-px flex-1 bg-secondary/20" />
        </div>

        <EmailSignInForm />
      </div>
    </main>
  );
}

// Not wired up yet: the server action receives the form but does nothing.
function EmailSignInForm() {
  async function signInWithEmail() {
    "use server";
  }

  return (
    <form action={signInWithEmail} className="flex flex-col gap-4">
      <Field id="email" label="Email" type="email" autoComplete="email" />
      <Field
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
      />
      <button
        type="submit"
        className="mt-2 rounded-md bg-tertiary px-5 py-3 text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        Sign in
      </button>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className="font-label text-xs uppercase tracking-[0.08em] text-secondary"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        required
        className="rounded-md border border-secondary/40 bg-surface px-3 py-2 text-primary focus:border-primary focus:outline-none"
      />
    </div>
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
      {error === "AccessDenied"
        ? "That Google account isn't registered as a sensei."
        : "Something went wrong signing in. Please try again."}
    </p>
  );
}

// Styled per Google's Sign-In branding guidelines (light theme, rectangular).
function GoogleSignInButton() {
  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <form action={signInWithGoogle}>
      <button
        type="submit"
        className="mt-6 flex h-10 w-full items-center justify-center gap-[10px] rounded-md border border-[#747775] bg-white px-3 font-roboto text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#f2f2f2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <GoogleLogo />
        Sign in with Google
      </button>
    </form>
  );
}

function GoogleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
