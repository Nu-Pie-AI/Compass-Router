"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";
import { compassRouterUrl } from "@/lib/product-urls";

export default function CompassLogoutPage() {
  useEffect(() => {
    void signOut({ redirect: false }).finally(() => {
      const routerUrl = new URL(compassRouterUrl);
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
