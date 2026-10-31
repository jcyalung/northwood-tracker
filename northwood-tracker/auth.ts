import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Google],
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    // Temporary: only the TEST_USER email may sign in. Swap for a lookup in
    // the `senseis` collection once it's populated.
    async signIn({ profile }) {
      const testUser = process.env.TEST_USER?.trim().toLowerCase();
      if (!testUser || !profile?.email || !profile.email_verified) return false;
      return profile.email.toLowerCase() === testUser;
    },
  },
});
