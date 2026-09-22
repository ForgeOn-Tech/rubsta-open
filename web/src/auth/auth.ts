import { eq } from "drizzle-orm";
import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import { authConfig } from "./config";
import { adminPasswordConfigured, PASSWORD_ADMIN_EMAIL, verifyAdminPassword } from "./admin-password";
import { db, getDb } from "@/db/client";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";

// Demo-mode sign-in identity. Only reachable when DEMO_AUTH=true (the provider
// is registered conditionally below and `authorize` re-checks the flag).
export const DEMO_EMAIL = "demo@rubstaopen.local";
export const DEMO_NAME = "Demo Player";

function demoProvider() {
  return Credentials({
    id: "demo",
    name: "Demo Account",
    credentials: {},
    async authorize() {
      // Guard: the demo provider must never exist when demo mode is off.
      if (process.env.DEMO_AUTH !== "true") return null;

      const existing = db
        .select()
        .from(users)
        .where(eq(users.email, DEMO_EMAIL))
        .get();
      if (existing) {
        return {
          id: existing.id,
          email: existing.email,
          name: existing.name,
          image: existing.image,
        };
      }
      // Upsert: create the demo user on first sign-in so foreign keys to
      // profiles/entries always resolve.
      const id = crypto.randomUUID();
      db.insert(users)
        .values({ id, email: DEMO_EMAIL, name: DEMO_NAME, emailVerified: new Date() })
        .run();
      return { id, email: DEMO_EMAIL, name: DEMO_NAME, image: null };
    },
  });
}

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

// Lazy config, built per request. The adapter rejects the `db` proxy (its
// prototype is not a drizzle class), so it gets the real instance; building it
// lazily also keeps `next build` from opening the database.
export const { handlers, auth, signIn, signOut } = NextAuth(() => ({
  ...authConfig,
  adapter: DrizzleAdapter(getDb(), {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  providers: [
    ...(adminPasswordConfigured() ? [Credentials({
      id: "admin-password",
      name: "Team username and password",
      credentials: { username: { type: "text" }, password: { type: "password" } },
      async authorize(credentials) {
        if (!await verifyAdminPassword(credentials.username, credentials.password)) return null;
        // Dedicated internal identity; never reuse a player's Google account.
        db.insert(users).values({ id: crypto.randomUUID(), email: PASSWORD_ADMIN_EMAIL, name: "Rubsta Team Admin" })
          .onConflictDoNothing({ target: users.email }).run();
        const user = db.select().from(users).where(eq(users.email, PASSWORD_ADMIN_EMAIL)).get();
        return user ? { id: user.id, email: user.email, name: user.name, image: null } : null;
      },
    })] : []),
    ...(googleConfigured
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
          }),
        ]
      : []),
    ...(process.env.DEMO_AUTH === "true" ? [demoProvider()] : []),
  ],
}));
