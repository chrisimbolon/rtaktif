/**
 * Next.js Edge Middleware — Auth guard + role-based routing.
 *
 * Reads the NextAuth session cookie (encrypted JWT) via auth()
 * and redirects based on auth state and user role.
 *
 * Runs on every non-static route before the page renders.
 */
import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that are always public (no session needed)
const PUBLIC_ROUTES  = ["/login", "/register"];

// Admin-only routes — warga gets bounced to /beranda
const ADMIN_ROUTES   = ["/dashboard", "/warga", "/tagihan", "/pengumuman", "/laporan", "/pengaturan"];

// Warga-only routes — admins get bounced to /dashboard
const WARGA_ROUTES   = ["/beranda", "/warga/tagihan", "/warga/pengumuman", "/warga/laporan", "/warga/profil"];

const ADMIN_ROLES    = ["admin_rt", "admin_rw", "super_admin"];

export default auth((request: NextRequest & { auth: any }) => {
  const { pathname }    = request.nextUrl;
  const session         = request.auth;
  const isAuthenticated = !!session?.user;
  const role            = session?.user?.role ?? "";

  // 1. Public routes — always allow
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    // If already logged in, skip login page → go home
    if (isAuthenticated) {
      const dest = ADMIN_ROLES.includes(role) ? "/dashboard" : "/beranda";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // 2. Root path — redirect based on auth state
  if (pathname === "/") {
    if (!isAuthenticated) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(
      ADMIN_ROLES.includes(role) ? "/dashboard" : "/beranda",
      request.url
    ));
  }

  // 3. Unauthenticated on protected route → login
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Account not active → show error on login page
  if (session.user.status === "suspended") {
    return NextResponse.redirect(new URL("/login?error=AccountSuspended", request.url));
  }

  // 5. Role-based access control
  const isAdmin  = ADMIN_ROLES.includes(role);
  const isWarga  = role === "warga";

  // Warga trying to access admin routes
  if (isWarga && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/beranda", request.url));
  }

  // Admin trying to access warga-only routes
  if (isAdmin && WARGA_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Pending user trying to access protected routes → login with message
  if (session.user.status === "pending") {
    return NextResponse.redirect(new URL("/login?error=AccountPending", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Run on all routes except Next.js internals and static files
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|fonts|icons).*)",
  ],
};
