import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function proxy(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (!token || token.role !== "admin") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (pathname.startsWith("/account")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  if (pathname.startsWith("/compass") && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/partners")) {
    const isPublicPartnerRoute =
      pathname === "/partners" || pathname.startsWith("/partners/register");

    if (!isPublicPartnerRoute && (!token || token.role !== "partner")) {
      return NextResponse.redirect(new URL("/login", req.url));
    }
  }

  // Allow public access to vendor landing page and registration
  // Protect other vendor routes (dashboard, products, leads, etc.)
  if (pathname.startsWith("/vendors")) {
    // Public routes: /vendors (landing page) and /vendors/register
    const isPublicVendorRoute = pathname === "/vendors" || pathname.startsWith("/vendors/register");

    if (!isPublicVendorRoute) {
      // Protected vendor routes require vendor role
      if (!token || token.role !== "vendor") {
        return NextResponse.redirect(new URL("/login", req.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/vendors/:path*", "/partners/:path*", "/account/:path*", "/compass/:path*"],
};
