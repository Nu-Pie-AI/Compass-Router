"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "../../lib/api";

export default function PortalPage() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let attempts = 0;
    let timer: number | undefined;
    const resolvePortal = () => {
      if (cancelled) return;
      const raw = window.localStorage.getItem("compass.local.session");
      let token = "";
      try {
        token = raw ? (JSON.parse(raw) as { token?: string }).token ?? "" : "";
      } catch {
        window.localStorage.removeItem("compass.local.session");
      }
      if (!token) {
        attempts += 1;
        if (attempts < 80) timer = window.setTimeout(resolvePortal, 100);
        else router.replace("/login?callbackUrl=%2Fportal");
        return;
      }
      void apiFetch<{ portal: string }>("/auth/portal", {}, token)
        .then(({ portal }) => { if (!cancelled) router.replace(portal === "super-admin" ? "/super-admin" : portal === "admin" ? "/admin" : "/dashboard"); })
        .catch(() => { if (!cancelled) router.replace("/login?callbackUrl=%2Fportal"); });
    };
    window.addEventListener("compass-clerk-session", resolvePortal);
    resolvePortal();
    return () => { cancelled = true; window.removeEventListener("compass-clerk-session", resolvePortal); if (timer) window.clearTimeout(timer); };
  }, [router]);
  return <main className="console-auth-loading">Opening your Compass workspace...</main>;
}
