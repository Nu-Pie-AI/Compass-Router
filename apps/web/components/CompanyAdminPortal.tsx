"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CompassConsole } from "./CompassConsole";

type Session = { portal?: string };

export function CompanyAdminPortal() {
  const router = useRouter();
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("compass.local.session");
      const session = raw ? JSON.parse(raw) as Session : null;
      if (session?.portal === "super-admin") router.replace("/super-admin");
    } catch {
      // CompassConsole owns authentication redirects and error states.
    }
  }, [router]);
  return <CompassConsole view="workspaces" />;
}
