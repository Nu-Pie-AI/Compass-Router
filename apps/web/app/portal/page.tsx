"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type Session = { portal?: string };

function destinationFor(session: Session) {
  return session.portal === "super-admin" ? "/super-admin" : session.portal === "admin" ? "/admin" : "/dashboard";
}

export default function PortalPage() {
  const router = useRouter();
  const resolving = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const resolvePortal = () => {
      if (cancelled || resolving.current) return;
      const raw = window.localStorage.getItem("compass.local.session");
      if (raw) {
        try {
          resolving.current = true;
          window.location.replace(destinationFor(JSON.parse(raw) as Session));
          return;
        } catch {
          window.localStorage.removeItem("compass.local.session");
        }
      }
      attempts += 1;
      if (attempts >= 80) {
        router.replace("/login?callbackUrl=%2Fportal");
        return;
      }
      timer = window.setTimeout(resolvePortal, 250);
    };
    window.addEventListener("compass-clerk-session", resolvePortal);
    resolvePortal();
    return () => { cancelled = true; window.removeEventListener("compass-clerk-session", resolvePortal); if (timer) window.clearTimeout(timer); };
  }, [router]);
  return <main className="console-auth-loading">Opening your Compass workspace...</main>;
}
