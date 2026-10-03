import type { DefaultSession } from "next-auth";

// Bloom adds its own API token and the user's id to the NextAuth session.
declare module "next-auth" {
  interface Session {
    accessToken?: string;
    user?: DefaultSession["user"] & { id?: string };
  }

  interface User {
    accessToken?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
  }
}
