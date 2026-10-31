"use client";

import { useState, useTransition, type FormEvent } from "react";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-rules";
import { createPassword, signInWithPassword, startSignIn } from "./actions";

type Step = "email" | "password" | "create";

// Email sign-in in steps: email, then either the password, or (first time)
// creating one.
export function EmailSignIn() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      if (step === "email") {
        setStep((await startSignIn(email)).step);
        return;
      }
      const result =
        step === "create"
          ? await createPassword(email, password, confirm)
          : await signInWithPassword(email, password);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Email">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          readOnly={step !== "email"}
          onChange={(e) => setEmail(e.target.value)}
          className={`${INPUT} ${step !== "email" ? "bg-neutral" : ""}`}
        />
      </Field>

      {step === "create" && (
        <p className="text-sm text-secondary">
          First time signing in? Create a password (at least{" "}
          {MIN_PASSWORD_LENGTH} characters).
        </p>
      )}
      {step !== "email" && (
        <Field label={step === "create" ? "New password" : "Password"}>
          <input
            type="password"
            required
            autoFocus
            minLength={step === "create" ? MIN_PASSWORD_LENGTH : undefined}
            autoComplete={
              step === "create" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={INPUT}
          />
        </Field>
      )}
      {step === "create" && (
        <Field label="Confirm password">
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={INPUT}
          />
        </Field>
      )}

      {error && (
        <p role="alert" className="text-sm text-tertiary">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 rounded-md bg-tertiary px-5 py-3 text-on-primary transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-wait disabled:opacity-60"
      >
        {pending
          ? "One moment…"
          : step === "email"
            ? "Continue"
            : step === "create"
              ? "Create password and sign in"
              : "Sign in"}
      </button>
      {step !== "email" && (
        <button
          type="button"
          onClick={() => {
            setStep("email");
            setPassword("");
            setConfirm("");
            setError(null);
          }}
          className="text-sm text-secondary underline underline-offset-2 hover:text-primary"
        >
          Use a different email
        </button>
      )}
    </form>
  );
}

const INPUT =
  "rounded-md border border-secondary/40 bg-surface px-3 py-2 text-primary focus:border-primary focus:outline-none";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-label text-xs uppercase tracking-[0.08em] text-secondary">
        {label}
      </span>
      {children}
    </label>
  );
}
