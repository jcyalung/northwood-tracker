"use server";

import { AuthError } from "next-auth";
import { cookies } from "next/headers";
import { signIn } from "@/auth";
import { accountFor, findPasswordHash, savePasswordHash } from "@/lib/accounts";
import { SENSEI_COOKIE } from "@/lib/current-sensei";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";

export type SignInStep = { step: "password" | "create" };
export type SignInResult = { error: string } | undefined;

// Step 1: which screen comes next. The manager or central account without a
// password yet creates one; everyone else enters a password.
export async function startSignIn(email: string): Promise<SignInStep> {
  const create = !!accountFor(email) && !(await findPasswordHash(email));
  return { step: create ? "create" : "password" };
}

async function credentialsSignIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  // Every sign-in starts by picking a sensei again.
  (await cookies()).delete(SENSEI_COOKIE);
  // The page after a Server Action redirect skips the proxy, so the central
  // account is sent to the sensei picker here.
  const redirectTo = accountFor(email) === "central" ? "/sensei" : "/";
  try {
    // Redirects on success (that redirect is a thrown signal).
    await signIn("credentials", { email, password, redirectTo });
  } catch (error) {
    if (error instanceof AuthError)
      return { error: "Wrong email or password." };
    throw error;
  }
}

export async function signInWithPassword(
  email: string,
  password: string,
): Promise<SignInResult> {
  return credentialsSignIn(email.trim().toLowerCase(), password);
}

// First sign-in: saves the account's chosen password (hashed), then signs
// in. Only works while the account has no password yet.
export async function createPassword(
  email: string,
  password: string,
  confirm: string,
): Promise<SignInResult> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` };
  }
  if (password.length > 200) return { error: "That password is too long." };
  if (password !== confirm) return { error: "The passwords don't match." };

  const normalized = email.trim().toLowerCase();
  if (!accountFor(normalized)) return { error: "Wrong email or password." };
  if (!(await savePasswordHash(normalized, await hashPassword(password)))) {
    return { error: "This account already has a password. Sign in instead." };
  }
  return credentialsSignIn(normalized, password);
}
