"use client";

import { useEffect, useRef, useState } from "react";
import { AdminConsole } from "../../components/AdminConsole";
import { CompanyAdminPortal } from "../../components/CompanyAdminPortal";
import { CompassConsole } from "../../components/CompassConsole";
import { PlatformOwnerActivation } from "../../components/PlatformOwnerActivation";
import { apiFetch } from "../../lib/api";

type Session = { portal?: string };
type BootstrapStatus = { available: boolean; status: string };

function destinationFor(session: Session) {
  return session.portal === "super-admin" ? "/super-admin" : session.portal === "admin" ? "/admin" : "/dashboard";
}

export default function PortalPage() {
  const [destination, setDestination] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [ownerActivation, setOwnerActivation] = useState(false);
  const resolving = useRef(false);
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const resolvePortal = async () => {
      if (cancelled || resolving.current) return;
      const raw = window.localStorage.getItem("compass.local.session");
      if (raw) {
        try {
          const bootstrap = await apiFetch<BootstrapStatus>("/admin/bootstrap/status");
          if (cancelled) return;
          if (bootstrap.available && bootstrap.status === "pending") {
            resolving.current = true;
            setOwnerActivation(true);
            return;
          }
        } catch {
          // Ordinary users receive a deliberately indistinguishable unavailable response.
        }
        try {
          resolving.current = true;
          const nextDestination = destinationFor(JSON.parse(raw) as Session);
          window.history.replaceState({}, "", nextDestination);
          setDestination(nextDestination);
          return;
        } catch {
          window.localStorage.removeItem("compass.local.session");
        }
      }
      attempts += 1;
      if (attempts >= 80) {
        window.location.replace("/login?callbackUrl=%2Fportal");
        return;
      }
      timer = window.setTimeout(resolvePortal, 250);
    };
    const showError = () => setError(true);
    window.addEventListener("compass-clerk-session", resolvePortal);
    window.addEventListener("compass-clerk-session-error", showError);
    resolvePortal();
    return () => { cancelled = true; window.removeEventListener("compass-clerk-session", resolvePortal); window.removeEventListener("compass-clerk-session-error", showError); if (timer) window.clearTimeout(timer); };
  }, []);
  if (error) {
    return <main className="console-auth-loading" role="alert"><p>This Clerk account is already linked to a different Compass account.</p><p>Sign out of Clerk and use the original account, or ask an administrator to link this account.</p><button className="console-primary" type="button" onClick={() => window.location.replace("/login?callbackUrl=%2Fportal")}>Return to sign in</button></main>;
  }
  if (ownerActivation) return <PlatformOwnerActivation />;
  if (destination === "/super-admin") return <AdminConsole />;
  if (destination === "/admin") return <CompanyAdminPortal />;
  if (destination === "/dashboard") return <CompassConsole view="dashboard" />;
  return <main className="console-auth-loading">Opening your Compass workspace...</main>;
}
