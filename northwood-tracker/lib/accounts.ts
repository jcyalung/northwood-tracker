import { db } from "@/lib/mongodb";

// The only two sign-ins, both set in .env: MANAGER_EMAIL (can add and remove
// senseis) and CENTRAL_EMAIL (shared by the senseis, who pick who they are
// after signing in). Each creates its password the first time it signs in.
export type Account = "manager" | "central";

function envEmail(name: "MANAGER_EMAIL" | "CENTRAL_EMAIL") {
  return process.env[name]?.trim().toLowerCase() || null;
}

export function accountFor(email?: string | null): Account | null {
  const normalized = email?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === envEmail("MANAGER_EMAIL")) return "manager";
  if (normalized === envEmail("CENTRAL_EMAIL")) return "central";
  return null;
}

// An Accounts document. `password_hash` is never sent to the browser.
type AccountDoc = { email: string; password_hash: string };

const accountsCollection = () => db.collection<AccountDoc>("accounts");

// One password per email, enforced by the database (made once per process).
let indexed: Promise<unknown> | undefined;
async function accounts() {
  indexed ??= accountsCollection()
    .createIndex({ email: 1 }, { unique: true })
    .catch((error) => {
      indexed = undefined;
      throw error;
    });
  await indexed;
  return accountsCollection();
}

export async function findPasswordHash(email: string): Promise<string | null> {
  const account = await (
    await accounts()
  ).findOne(
    { email: email.trim().toLowerCase() },
    { projection: { _id: 0, password_hash: 1 } },
  );
  return account?.password_hash ?? null;
}

// Saves a first password; false if the account already has one.
export async function savePasswordHash(
  email: string,
  password_hash: string,
): Promise<boolean> {
  try {
    await (
      await accounts()
    ).insertOne({ email: email.trim().toLowerCase(), password_hash });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}
