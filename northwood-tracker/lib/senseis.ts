import { db } from "@/lib/mongodb";

import type { Role } from "@/lib/roles";

export { ROLES, SENSEI_ROLE, type Role } from "@/lib/roles";

// A Senseis document (rsrc/SCHEMA.md). Senseis don't sign in themselves:
// they pick their name after the central account signs in.
export type Sensei = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: Role;
};

export const senseisCollection = () => db.collection<Sensei>("senseis");
