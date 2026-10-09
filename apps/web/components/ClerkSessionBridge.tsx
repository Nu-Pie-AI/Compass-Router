"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect } from "react";
import { apiFetch, registerClerkSessionProviders } from "../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };

export default function ClerkSessionBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();

  useEffect(() => {
    registerClerkSessionProviders(getToken, signOut);
    return () => registerClerkSessionProviders(null, null);
  }, [getToken, signOut]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      window.localStorage.removeItem("compass.local.session");
      window.dispatchEvent(new Event("compass-clerk-session"));
      return;
    }
    let cancelled = false;
    void getToken().then((token) => {
      if (!token) throw new Error("Clerk did not issue a session token.");
      return apiFetch<Session>("/auth/clerk/bootstrap", { method: "POST" }, token);
    }).then((session) => {
      if (!cancelled) {
        window.localStorage.setItem("compass.local.session", JSON.stringify(session));
        window.dispatchEvent(new Event("compass-clerk-session"));
      }
    }).catch(() => {
      if (!cancelled) {
        window.localStorage.removeItem("compass.local.session");
        window.dispatchEvent(new Event("compass-clerk-session"));
      }
    });
    return () => { cancelled = true; };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
