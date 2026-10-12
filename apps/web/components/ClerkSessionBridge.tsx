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
    void getTokenRef.current().then((token) => {
      if (!token) throw new Error("Clerk did not issue a session token.");
      return apiFetch<Session>("/auth/clerk/bootstrap", { method: "POST" }, token);
    }).then((session) => {
      window.localStorage.setItem("compass.local.session", JSON.stringify(session));
      window.dispatchEvent(new Event("compass-clerk-session"));
    }).catch(() => {
      bootstrapStarted.current = false;
      window.localStorage.removeItem("compass.local.session");
      window.dispatchEvent(new Event("compass-clerk-session"));
      window.dispatchEvent(new Event("compass-clerk-session-error"));
    });
  }, [isLoaded, isSignedIn]);

  return null;
}
