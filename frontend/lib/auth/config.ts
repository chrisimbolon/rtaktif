/**
 * NextAuth v5 configuration.
 *
 * Flow:
 *   1. CredentialsProvider.authorize() calls FastAPI /auth/login → gets raw JWT
 *   2. Calls FastAPI /users/me with that JWT → gets full user profile
 *   3. Both are stored in the NextAuth JWT (encrypted httpOnly cookie)
 *   4. Session callback exposes them to client via useSession()
 *   5. apiClient reads backendToken from session to call FastAPI
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const authConfig: NextAuthConfig = {
  // ── JWT strategy — no DB needed ────────────────────────────────
  session: { strategy: "jwt" },

  // ── Custom pages ───────────────────────────────────────────────
  pages: {
    signIn:  "/login",
    signOut: "/login",
    error:   "/login",
  },

  providers: [
    CredentialsProvider({
      name: "RukunRT",
      credentials: {
        email:    { label: "Email",    type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // Step 1: get FastAPI JWT
          const loginRes = await fetch(`${API_URL}/auth/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email:    credentials.email,
              password: credentials.password,
            }),
          });

          if (!loginRes.ok) return null;

          const { access_token } = await loginRes.json() as { access_token: string };

          // Step 2: get user profile using that token
          const meRes = await fetch(`${API_URL}/users/me`, {
            headers: { Authorization: `Bearer ${access_token}` },
          });

          if (!meRes.ok) return null;

          const user = await meRes.json() as {
            id: string; email: string; full_name: string;
            role: string; status: string; rt_group_id: string | null;
          };

          // NextAuth user object — everything we need downstream
          return {
            id:            user.id,
            email:         user.email,
            name:          user.full_name,
            role:          user.role,
            status:        user.status,
            rt_group_id:   user.rt_group_id,
            backendToken:  access_token,      // ← raw FastAPI JWT, forwarded to all API calls
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    /**
     * jwt() runs when a token is created or updated.
     * We copy our custom fields from the provider user → the JWT.
     */
    async jwt({ token, user }) {
      if (user) {
        token.id           = user.id;
        token.role         = (user as any).role;
        token.status       = (user as any).status;
        token.rt_group_id  = (user as any).rt_group_id;
        token.backendToken = (user as any).backendToken;
        token.full_name    = user.name ?? "";
      }
      return token;
    },

    /**
     * session() shapes what useSession() returns on the client.
     * We expose role, status, rt_group_id and the raw FastAPI token.
     */
    async session({ session, token }) {
      session.user.id           = token.id as string;
      session.user.role         = token.role as string;
      session.user.status       = token.status as string;
      session.user.rt_group_id  = token.rt_group_id as string | null;
      session.user.full_name    = token.full_name as string;
      session.backendToken      = token.backendToken as string;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
