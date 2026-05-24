// types/next-auth.d.ts
// IMPORTANT: This file MUST be named next-auth.d.ts (not next-auth-d-ts.ts)
// The .d.ts extension tells TypeScript this is a declaration file

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

// Note: next-auth/jwt augmentation removed — causes issues in some
// next-auth v5 beta versions. JWT fields are accessed via session callbacks.
export {};
