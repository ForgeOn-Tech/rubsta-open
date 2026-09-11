import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

// next-auth/jwt only re-exports @auth/core/jwt, so augment the source module.
declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
  }
}
