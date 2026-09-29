"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function CompassLogoutPage() {
  useEffect(() => {
    void signOut({ redirect: false }).finally(() => {
      const routerUrl = new URL(process.env.NEXT_PUBLIC_COMPASS_ROUTER_URL || "https://compass-router-web-567790052414.us-central1.run.app");
      routerUrl.searchParams.set("signedOut", "1");
      window.location.assign(routerUrl.toString());
    });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <p className="text-sm text-[var(--muted-foreground)]">Signing you out of Compass...</p>
    </main>
  );
}
