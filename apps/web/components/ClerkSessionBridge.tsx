"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { apiFetch, registerClerkSessionProviders } from "../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string; portal?: string };

export default function ClerkSessionBridge() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { signOut } = useClerk();
  const bootstrapStarted = useRef(false);
  const getTokenRef = useRef(getToken);

  useEffect(() => {
    getTokenRef.current = getToken;
  }, [getToken]);

  useEffect(() => {
    registerClerkSessionProviders(getToken, signOut);
    return () => registerClerkSessionProviders(null, null);
  }, [getToken, signOut]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      // Clerk can briefly report an unauthenticated client state while the
      // provider rehydrates during a portal navigation. Preserve a valid
      // Compass bootstrap session until an explicit logout clears it.
      if (window.localStorage.getItem("compass.local.session")) return;
      bootstrapStarted.current = false;
      window.localStorage.removeItem("compass.local.session");
      window.dispatchEvent(new Event("compass-clerk-session"));
      return;
    }
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    let timeout: number | undefined;
    const bootstrap = (async () => {
      const token = await getTokenRef.current();
      if (!token) throw new Error("Clerk did not issue a session token.");
      return apiFetch<Session>("/auth/clerk/bootstrap", { method: "POST" }, token);
    })();
    const deadline = new Promise<never>((_, reject) => {
      timeout = window.setTimeout(() => reject(new Error("Compass session bootstrap timed out.")), 12000);
    });
    void Promise.race([bootstrap, deadline]).then((session) => {
      window.clearTimeout(timeout);
      window.localStorage.setItem("compass.local.session", JSON.stringify(session));
      window.dispatchEvent(new Event("compass-clerk-session"));
    }).catch((reason) => {
      window.clearTimeout(timeout);
      bootstrapStarted.current = false;
      window.localStorage.removeItem("compass.local.session");
      window.dispatchEvent(new Event("compass-clerk-session"));
      const message = reason instanceof Error ? reason.message : "Compass session bootstrap failed.";
      window.dispatchEvent(new CustomEvent("compass-clerk-session-error", { detail: { message } }));
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
