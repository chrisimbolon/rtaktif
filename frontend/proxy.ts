// proxy.ts — Next.js 16
// IMPORTANT: Must use "export default function proxy"
// Auth logic moved to SessionGuard + layout.tsx (Next.js 16 pattern)
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_ROUTES = ["/", "/login", "/register"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes — no auth check here
  // Auth is handled by SessionGuard in (admin)/layout.tsx
  if (PUBLIC_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"))) {
    return NextResponse.next();
  }

  // For all other routes — just pass through
  // Route protection is handled at the layout level
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|images|fonts|icons|public).*)",
  ],
};
