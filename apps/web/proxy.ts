import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/admin(.*)",
  "/extension/authorize(.*)",
]);

const clerkHandler = clerkMiddleware(async (auth, request) => {
  if (isProtectedRoute(request)) await auth.protect();
});

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }
  if (!isProtectedRoute(request)) {
    return NextResponse.next();
  }
  try {
    return await clerkHandler(request, event);
  } catch {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", `${request.nextUrl.pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
