"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { apiFetch } from "../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };

export function MarketplaceAuthCallback({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    void apiFetch<Session>("/auth/marketplace", {
      method: "POST",
      body: JSON.stringify({ token }),
    }).then((session) => {
      window.localStorage.setItem("compass.local.session", JSON.stringify(session));
      router.replace("/dashboard");
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : "Could not complete Marketplace sign-in.");
    });
  }, [router, token]);

  if (!token) return <main className="console-auth-loading"><p role="alert">The Marketplace sign-in handoff is missing.</p></main>;
  return <main className="console-auth-loading">{error ? <p role="alert">{error}</p> : <p>Signing you in to Compass...</p>}</main>;
}
