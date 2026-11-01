"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import { ROLES, senseisCollection } from "@/lib/senseis";

export type SenseiRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};
export type SenseiResult =
  { ok: true; sensei?: SenseiRow } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The manager account only, checked here (Server Functions can be called
// directly).
async function requireManager() {
  const session = await auth();
  return session?.user.account === "manager" ? session : null;
}

export async function addSensei(input: {
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
}): Promise<SenseiResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "Only the manager can add senseis." };
  }
  const first_name = input.first_name?.trim();
  const last_name = input.last_name?.trim();
  const email = input.email?.trim().toLowerCase();
  const role = ROLES.find((r) => r.role_id === input.role_id);
  if (!first_name || !last_name) {
    return { ok: false, error: "First and last name are required." };
  }
  if (!email || !EMAIL.test(email)) {
    return { ok: false, error: "Enter a valid email." };
  }
  if (!role) return { ok: false, error: "Pick a role." };

  const sensei = { id: randomUUID(), first_name, last_name, email, role };
  try {
    await senseisCollection().insertOne({ ...sensei });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, error: `${email} is already a sensei.` };
    }
    throw error;
  }
  return { ok: true, sensei: { id: sensei.id, first_name, last_name, email } };
}

export async function removeSensei(id: string): Promise<SenseiResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "Only the manager can remove senseis." };
  }
  const { deletedCount } = await senseisCollection().deleteOne({ id });
  if (!deletedCount) {
    return { ok: false, error: "That sensei was already removed." };
  }
  return { ok: true };
}
