"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@/auth";
import {
  isManager,
  MANAGER_ROLES,
  ROLES,
  senseisCollection,
} from "@/lib/senseis";

export type SenseiRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
};
export type SenseiResult =
  { ok: true; sensei?: SenseiRow } | { ok: false; error: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Managers only, checked here (Server Functions can be called directly).
async function requireManager() {
  const session = await auth();
  return session && isManager(session.user.role) ? session : null;
}

export async function addSensei(input: {
  first_name: string;
  last_name: string;
  email: string;
  role_id: number;
}): Promise<SenseiResult> {
  if (!(await requireManager())) {
    return { ok: false, error: "Only managers can add senseis." };
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
    // No password yet: they create one the first time they sign in.
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
  const session = await requireManager();
  if (!session)
    return { ok: false, error: "Only managers can remove senseis." };

  const sensei = await senseisCollection().findOne(
    { id },
    { projection: { _id: 0, email: 1, role: 1 } },
  );
  if (!sensei) return { ok: false, error: "That sensei was already removed." };
  if (sensei.email === session.user.email?.toLowerCase()) {
    return { ok: false, error: "You can't remove yourself." };
  }
  if (isManager(sensei.role)) {
    const managers = await senseisCollection().countDocuments({
      "role.role_id": { $in: MANAGER_ROLES.map((r) => r.role_id) },
    });
    if (managers <= 1) {
      return { ok: false, error: "There has to be at least one manager." };
    }
  }
  await senseisCollection().deleteOne({ id });
  return { ok: true };
}
