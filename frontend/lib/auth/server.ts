/**
 * Server-side auth helpers.
 *
 * Use these in Server Components, Server Actions, and Route Handlers
 * where useSession() (client-only) is not available.
 *
 * Usage in a Server Component:
 *   import { requireAuth, requireAdmin } from "@/lib/auth/server";
 *   const session = await requireAuth();
 *
 * Usage in a Route Handler:
 *   import { getServerSession } from "@/lib/auth/server";
 *   const session = await getServerSession();
 *   if (!session) return new Response("Unauthorized", { status: 401 });
 */
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

const ADMIN_ROLES = ["admin_rt", "admin_rw", "super_admin"];

/** Returns session or null — safe, never throws */
export async function getServerSession() {
  return auth();
}

/**
 * Returns session or redirects to /login.
 * Use in any Server Component that requires authentication.
 */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session;
}

/**
 * Returns session or redirects to /dashboard.
 * Use in Server Components that require admin role.
 */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user)                        redirect("/login");
  if (!ADMIN_ROLES.includes(session.user.role)) redirect("/beranda");
  return session;
}

/**
 * Returns the raw FastAPI JWT from the session.
 * Use when making server-side fetch() calls to the FastAPI backend.
 *
 * Example:
 *   const token = await getBackendToken();
 *   const res = await fetch(`${API_URL}/warga/rt/${rtId}`, {
 *     headers: { Authorization: `Bearer ${token}` }
 *   });
 */
export async function getBackendToken(): Promise<string | null> {
  const session = await auth();
  return session?.backendToken ?? null;
}
