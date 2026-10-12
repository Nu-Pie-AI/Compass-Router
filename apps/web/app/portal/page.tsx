"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Session = { portal?: string };

function destinationFor(session: Session) {
  return session.portal === "super-admin" ? "/super-admin" : session.portal === "admin" ? "/admin" : "/dashboard";
}

export default function PortalPage() {
  const router = useRouter();
  const [error, setError] = useState(false);
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
    const showError = () => setError(true);
    window.addEventListener("compass-clerk-session", resolvePortal);
    window.addEventListener("compass-clerk-session-error", showError);
    resolvePortal();
    return () => { cancelled = true; window.removeEventListener("compass-clerk-session", resolvePortal); window.removeEventListener("compass-clerk-session-error", showError); if (timer) window.clearTimeout(timer); };
  }, [router]);
  if (error) {
    return <main className="console-auth-loading" role="alert"><p>This Clerk account is already linked to a different Compass account.</p><p>Sign out of Clerk and use the original account, or ask an administrator to link this account.</p><button className="console-primary" type="button" onClick={() => router.replace("/login?callbackUrl=%2Fportal")}>Return to sign in</button></main>;
  }
  return <main className="console-auth-loading">Opening your Compass workspace...</main>;
}
