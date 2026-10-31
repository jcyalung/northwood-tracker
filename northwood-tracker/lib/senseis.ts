import { db } from "@/lib/mongodb";

import { MANAGER_ROLES, type Role } from "@/lib/roles";

export {
  isManager,
  MANAGER_ROLES,
  ROLES,
  SENSEI_ROLE,
  type Role,
} from "@/lib/roles";

// A Senseis document (rsrc/SCHEMA.md). `password_hash` is set when they
// first sign in; it's never sent to the browser.
export type Sensei = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
  password_hash?: string;
};

export const senseisCollection = () => db.collection<Sensei>("senseis");

export function findSensei(email: string) {
  return senseisCollection().findOne(
    { email: email.trim().toLowerCase() },
    { projection: { _id: 0 } },
  );
}

// Until the first manager is added, the TEST_USER account (from .env) can
// sign in as a manager so someone can set things up.
export async function bootstrapManagerEmail(): Promise<string | null> {
  const testUser = process.env.TEST_USER?.trim().toLowerCase();
  if (!testUser) return null;
  const managers = await senseisCollection().countDocuments({
    "role.role_id": { $in: MANAGER_ROLES.map((r) => r.role_id) },
  });
  return managers === 0 ? testUser : null;
}
