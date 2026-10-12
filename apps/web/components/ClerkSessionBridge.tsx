"use client";

import { useAuth, useClerk } from "@clerk/nextjs";
import { useEffect, useRef } from "react";
import { apiFetch, registerClerkSessionProviders } from "../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };

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
      bootstrapStarted.current = false;
      window.localStorage.removeItem("compass.local.session");
      window.dispatchEvent(new Event("compass-clerk-session"));
      return;
    }
    if (bootstrapStarted.current) return;
    bootstrapStarted.current = true;
    let cancelled = false;
    void getTokenRef.current().then((token) => {
      if (!token) throw new Error("Clerk did not issue a session token.");
      return apiFetch<Session>("/auth/clerk/bootstrap", { method: "POST" }, token);
    }).then((session) => {
      if (!cancelled) {
        window.localStorage.setItem("compass.local.session", JSON.stringify(session));
        window.dispatchEvent(new Event("compass-clerk-session"));
      }
    }).catch(() => {
      bootstrapStarted.current = false;
      if (!cancelled) {
        window.localStorage.removeItem("compass.local.session");
        window.dispatchEvent(new Event("compass-clerk-session"));
        window.dispatchEvent(new Event("compass-clerk-session-error"));
      }
    });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn]);

  return null;
}
