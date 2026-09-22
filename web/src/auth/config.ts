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
    jwt({ token, user, account }) {
      if (user) {
        token.id = user.id ?? token.sub ?? "";
      }
      if (account?.provider === "admin-password") {
        token.adminPasswordVersion = process.env.ADMIN_PASSWORD_VERSION;
        token.adminPasswordExpires = Date.now() + 8 * 60 * 60 * 1000;
      }
      if (token.adminPasswordVersion && (
        !process.env.ADMIN_PASSWORD_HASH || token.adminPasswordVersion !== process.env.ADMIN_PASSWORD_VERSION
        || typeof token.adminPasswordExpires !== "number" || Date.now() >= token.adminPasswordExpires
      )) return null;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      return session;
    },
  },
};
