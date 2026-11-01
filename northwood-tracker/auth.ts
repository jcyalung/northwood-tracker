import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { accountFor, findPasswordHash, type Account } from "@/lib/accounts";
import { verifyPassword } from "@/lib/password";

declare module "next-auth" {
  interface Session {
    user: { account: Account } & DefaultSession["user"];
  }
}
declare module "@auth/core/jwt" {
  interface JWT {
    account?: Account;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    // Only MANAGER_EMAIL and CENTRAL_EMAIL (lib/accounts.ts) can sign in.
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const account = accountFor(email);
        const hash = account ? await findPasswordHash(email) : null;
        if (!account || !hash || !(await verifyPassword(password, hash))) {
          // A short pause slows down password guessing.
          await wait(1000);
          return null;
        }
        return {
          id: email,
          email,
          name: account === "manager" ? "Manager" : "Center",
        };
      },
    }),
  ],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Checked on every request, so changing MANAGER_EMAIL or CENTRAL_EMAIL
    // in .env signs out the old account.
    jwt({ token }) {
      const account = accountFor(token.email);
      if (!account) return null;
      token.account = account;
      return token;
    },
    session({ session, token }) {
      session.user.account = token.account ?? "central";
      return session;
    },
  },
});
