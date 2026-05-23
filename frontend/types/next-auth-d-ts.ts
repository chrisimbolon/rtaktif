// types/next-auth.d.ts
// Place at: types/next-auth.d.ts
// This augments the NextAuth Session and JWT types

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    backendToken: string;
    user: {
      id:          string;
      email:       string;
      full_name:   string;
      role:        string;
      status:      string;
      rt_group_id: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role:         string;
    status:       string;
    rt_group_id:  string | null;
    backendToken: string;
    full_name:    string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id:           string;
    role:         string;
    status:       string;
    rt_group_id:  string | null;
    full_name:    string;
    backendToken: string;
  }
}
