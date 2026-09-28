"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function CompassLogoutPage() {
  useEffect(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--background)] px-6">
      <p className="text-sm text-[var(--muted-foreground)]">Signing you out of Compass...</p>
    </main>
  );
}
