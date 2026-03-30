/**
 * NextAuth v5 type augmentations.
 *
 * Extends the default session types to include the user's role
 * and id on the session object.
 */

import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: string;
    };
  }

  interface User {
    role?: string;
  }
}
