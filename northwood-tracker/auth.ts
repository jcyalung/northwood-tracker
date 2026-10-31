import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { verifyPassword } from "@/lib/password";
import {
  bootstrapManagerEmail,
  findSensei,
  MANAGER_ROLES,
  SENSEI_ROLE,
  type Role,
} from "@/lib/senseis";

declare module "next-auth" {
  interface Session {
    user: { role: Role } & DefaultSession["user"];
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
    // When the role was last checked against the senseis collection (ms).
    checkedAt?: number;
  }
}

// How often a signed-in sensei's role is re-checked (and a removed sensei
// signed out). Kept coarse so it's light on the Pi.
const RECHECK_MS = 60_000;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// The role for an email: from the senseis collection, or manager for the
// bootstrap TEST_USER until the first manager exists; null if not allowed.
async function roleFor(
  email: string,
): Promise<{ role: Role; name?: string } | null> {
  const sensei = await findSensei(email);
  if (sensei) {
    return {
      role: sensei.role,
      name: `${sensei.first_name} ${sensei.last_name}`,
    };
  }
  return (await bootstrapManagerEmail()) === email.toLowerCase()
    ? { role: MANAGER_ROLES[0] }
    : null;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Works on localhost; Google won't accept northwood.local (not a public
    // domain), so senseis on the local network sign in with a password.
    Google,
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const sensei = email ? await findSensei(email) : null;
        if (
          !sensei?.password_hash ||
          !(await verifyPassword(password, sensei.password_hash))
        ) {
          // A short pause slows down password guessing.
          await wait(1000);
          return null;
        }
        return {
          id: sensei.id,
          email: sensei.email,
          name: `${sensei.first_name} ${sensei.last_name}`,
        };
      },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Google sign-ins: only senseis (or the bootstrap TEST_USER).
    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;
      if (!profile?.email || !profile.email_verified) return false;
      return (await roleFor(profile.email)) !== null;
    },
    async jwt({ token, user }) {
      const due = !token.checkedAt || Date.now() - token.checkedAt > RECHECK_MS;
      if ((user || due) && token.email) {
        const found = await roleFor(token.email);
        // Removed from the senseis list: end the session.
        if (!found) return null;
        token.role = found.role;
        if (found.name) token.name = found.name;
        token.checkedAt = Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role ?? SENSEI_ROLE;
      return session;
    },
  },
});
