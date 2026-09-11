import type { NextAuthConfig } from "next-auth";

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

/**
 * Edge-safe base config (no DB imports) shared by the full Node-side auth
 * setup in `auth.ts`. Providers are added there.
 */
export const authConfig: NextAuthConfig = {
  providers: [],
  session: {
    strategy: "jwt",
    maxAge: THIRTY_DAYS_SECONDS,
  },
  pages: {
    signIn: "/signin",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      return session;
    },
  },
};
