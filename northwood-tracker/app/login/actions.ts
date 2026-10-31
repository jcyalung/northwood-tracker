"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/password";
import { findSensei, senseisCollection } from "@/lib/senseis";

export type SignInStep = { step: "password" | "create" };
export type SignInResult = { error: string } | undefined;

// Step 1: which screen comes next. A sensei without a password yet creates
// one; everyone else (including unknown emails, so this doesn't reveal who
// is a sensei) enters a password.
export async function startSignIn(email: string): Promise<SignInStep> {
  const sensei = email.trim() ? await findSensei(email) : null;
  return { step: sensei && !sensei.password_hash ? "create" : "password" };
}

async function credentialsSignIn(
  email: string,
  password: string,
): Promise<SignInResult> {
  try {
    // Redirects to the menu on success (that redirect is a thrown signal).
    await signIn("credentials", { email, password, redirectTo: "/" });
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

// First sign-in: saves the sensei's chosen password (hashed), then signs in.
// Only works while the account has no password yet.
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
  const result = await senseisCollection().updateOne(
    { email: normalized, password_hash: { $exists: false } },
    { $set: { password_hash: await hashPassword(password) } },
  );
  if (result.matchedCount !== 1) {
    return { error: "This account already has a password. Sign in instead." };
  }
  return credentialsSignIn(normalized, password);
}
