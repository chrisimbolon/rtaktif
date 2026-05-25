// proxy.ts — Next.js 16 convention
// Function MUST be named "proxy" (not default export)
import { auth } from "@/lib/auth/config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register"];
const ADMIN_ROUTES  = ["/dashboard", "/warga", "/tagihan", "/pengumuman", "/laporan", "/pengaturan"];
const WARGA_ROUTES  = ["/beranda", "/warga/tagihan", "/warga/pengumuman", "/warga/laporan", "/warga/profil"];
const ADMIN_ROLES   = ["admin_rt", "admin_rw", "super_admin"];

// ── Named "proxy" export — required in Next.js 16 ─────────────────
export const proxy = auth((request: NextRequest & { auth: any }) => {
  const { pathname } = request.nextUrl;
  const session      = request.auth;
  const isAuth       = !!session?.user;
  const role         = (session?.user as any)?.role ?? "";

  // 1. Public routes — always allow
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    // Already logged in hitting /login or /register → redirect to app
    if (isAuth && (pathname.startsWith("/login") || pathname.startsWith("/register"))) {
      const dest = ADMIN_ROLES.includes(role) ? "/dashboard" : "/beranda";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    // "/" and other public routes → just show the page
    return NextResponse.next();
  }

  // 2. Not authenticated → login
  if (!isAuth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 3. Suspended account
  if ((session.user as any).status === "suspended") {
    return NextResponse.redirect(new URL("/login?error=AccountSuspended", request.url));
  }

  // 4. Pending account on protected route
  if ((session.user as any).status === "pending") {
    return NextResponse.redirect(new URL("/login?error=AccountPending", request.url));
  }

  // 5. Role-based access
  const isAdmin = ADMIN_ROLES.includes(role);
  const isWarga = role === "warga";

  if (isWarga && ADMIN_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/beranda", request.url));
  }
  if (isAdmin && WARGA_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|fonts|icons|public).*)",
  ],
};
