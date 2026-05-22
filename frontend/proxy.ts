// middleware.ts
// Place this at the ROOT of your frontend folder (same level as app/)
import { auth } from "@/lib/auth/config";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/login", "/register"];
const ADMIN_ROUTES  = ["/dashboard", "/warga", "/tagihan", "/pengumuman", "/laporan", "/pengaturan"];
const WARGA_ROUTES  = ["/beranda", "/warga/tagihan", "/warga/pengumuman", "/warga/laporan", "/warga/profil"];
const ADMIN_ROLES   = ["admin_rt", "admin_rw", "super_admin"];

export default auth((request: NextRequest & { auth: any }) => {
  const { pathname } = request.nextUrl;
  const session      = request.auth;
  const isAuth       = !!session?.user;
  const role         = session?.user?.role ?? "";

  // 1. Public routes — allow always
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    // Already logged in → skip login page
    if (isAuth) {
      const dest = ADMIN_ROLES.includes(role) ? "/dashboard" : "/beranda";
      return NextResponse.redirect(new URL(dest, request.url));
    }
    return NextResponse.next();
  }

  // 2. Root → redirect based on auth
  if (pathname === "/") {
    if (!isAuth) return NextResponse.redirect(new URL("/login", request.url));
    return NextResponse.redirect(new URL(
      ADMIN_ROLES.includes(role) ? "/dashboard" : "/beranda",
      request.url
    ));
  }

  // 3. Not authenticated → login
  if (!isAuth) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Suspended account
  if (session.user.status === "suspended") {
    return NextResponse.redirect(new URL("/login?error=AccountSuspended", request.url));
  }

  // 5. Pending account on protected route
  if (session.user.status === "pending") {
    return NextResponse.redirect(new URL("/login?error=AccountPending", request.url));
  }

  // 6. Role-based access
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
