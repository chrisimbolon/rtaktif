// lib/auth/config.ts
import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Server-side API URL — used in authorize() which runs inside the container
// In Docker: use internal container name
// Locally: use localhost
const API_URL = process.env.INTERNAL_API_URL        // Docker internal
  ?? process.env.NEXT_PUBLIC_API_URL                 // fallback
  ?? "http://localhost:8000/api/v1";

export const authConfig: NextAuthConfig = {
  session:   { strategy: "jwt" },
  trustHost: true,

  pages: {
    signIn:  "/login",
    signOut: "/login",
    error:   "/login",
  },

  providers: [
    CredentialsProvider({
      name: "RTMudah",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        console.log(`[auth] authorize() calling: ${API_URL}/auth/login`);

        try {
          const loginRes = await fetch(`${API_URL}/auth/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });

          console.log(`[auth] login response status: ${loginRes.status}`);

          if (!loginRes.ok) {
            const err = await loginRes.text();
            console.log(`[auth] login failed: ${err}`);
            return null;
          }

          const { access_token } = await loginRes.json() as { access_token: string };

          const meRes = await fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          if (!meRes.ok) return null;

          const profile = await meRes.json() as {
            id: string; email: string; full_name: string;
            role: string; status: string; rt_group_id: string | null;
          };

          return {
            id:           profile.id,
            email:        profile.email,
            name:         profile.full_name,
            full_name:    profile.full_name,
            role:         profile.role,
            status:       profile.status,
            rt_group_id:  profile.rt_group_id,
            backendToken: access_token,
          };
        } catch (e) {
          console.error(`[auth] authorize() error:`, e);
          return null;
        }
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const u = user as any;
        token.id           = u.id;
        token.role         = u.role;
        token.status       = u.status;
        token.rt_group_id  = u.rt_group_id;
        token.backendToken = u.backendToken;
        token.full_name    = u.full_name;
      }
      return token;
    },

    async session({ session, token }) {
      const t = token as any;
      const s = session as any;
      s.user.id           = t.id;
      s.user.role         = t.role;
      s.user.status       = t.status;
      s.user.rt_group_id  = t.rt_group_id;
      s.user.full_name    = t.full_name;
      s.backendToken      = t.backendToken;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
