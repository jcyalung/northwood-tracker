import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { accountFor, findPasswordHash, type Account } from "@/lib/accounts";
import { log, logError } from "@/lib/logs";
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
      async authorize(credentials, request) {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        const account = accountFor(email);
        // nginx passes the device's address along.
        const from = request.headers.get("x-forwarded-for")?.split(",")[0];
        let hash: string | null;
        try {
          hash = account ? await findPasswordHash(email) : null;
        } catch (error) {
          logError(error, `Sign-in for ${email}`);
          throw error;
        }
        if (!account || !hash || !(await verifyPassword(password, hash))) {
          log("warn", "sign-in", `Failed sign-in for ${email || "(no email)"}`, {
            detail: [
              !account
                ? "Not the manager or center email"
                : !hash
                  ? "No password set yet"
                  : "Wrong password",
              from && `from ${from}`,
            ]
              .filter(Boolean)
              .join(", "),
          });
          // A short pause slows down password guessing.
          await wait(1000);
          return null;
        }
        log(
          "info",
          "sign-in",
          account === "manager" ? "Manager signed in" : "Center account signed in",
          { detail: from && `from ${from}` },
        );
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
