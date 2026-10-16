"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { Compass } from "lucide-react";
import { useEffect, useState } from "react";

export default function ClerkLoginForm() {
  const { isLoaded, isSignedIn } = useAuth();
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [hasCompassSession, setHasCompassSession] = useState(false);
  const [bootstrapError, setBootstrapError] = useState("");
  const [redirectPath] = useState(() => {
    if (typeof window === "undefined") return "/portal";
    const callback = new URLSearchParams(window.location.search).get("callbackUrl") || "/portal";
    return callback.startsWith("/") && !callback.startsWith("//") ? callback : "/portal";
  });
  const extensionCallback = redirectPath.startsWith("/extension/authorize");
  useEffect(() => {
    const syncCompassSession = () => {
      const hasSession = Boolean(window.localStorage.getItem("compass.local.session"));
      setHasCompassSession(hasSession);
      if (window.location.pathname === "/login" && ((extensionCallback && isLoaded && isSignedIn) || hasSession)) {
        window.location.replace(redirectPath);
      }
    };
    syncCompassSession();
    window.addEventListener("compass-clerk-session", syncCompassSession);
    const onBootstrapError = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      setBootstrapError(message || "Compass could not finish the secure session.");
    };
    window.addEventListener("compass-clerk-session-error", onBootstrapError);
    const poll = window.setInterval(syncCompassSession, 250);
    return () => {
      window.removeEventListener("compass-clerk-session", syncCompassSession);
      window.removeEventListener("compass-clerk-session-error", onBootstrapError);
      window.clearInterval(poll);
    };
  }, [extensionCallback, isLoaded, isSignedIn, redirectPath]);

  useEffect(() => {
    const waitingForClerk = !isLoaded;
    const waitingForBootstrap = isLoaded && isSignedIn && !hasCompassSession;
    if (!waitingForClerk && !waitingForBootstrap) {
      setLoadTimedOut(false);
      return;
    }
    const timer = window.setTimeout(() => setLoadTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [hasCompassSession, isLoaded, isSignedIn]);

  return (
    <main className="console-login">
      <section className="clerk-login-layout" aria-labelledby="login-title">
        <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
        <div className="console-login-copy"><span>WORKSPACE ACCESS</span><h1 id="login-title">Welcome back</h1><p>Sign in securely with your Compass account.</p></div>
        {loadTimedOut && !bootstrapError ? (
          <div className="compass-auth-status" role="alert">
            <strong>{isSignedIn ? "Workspace connection is taking longer than expected." : "Sign-in is taking longer than expected."}</strong>
            <p>{isSignedIn ? "Your Compass session was not finished before the device authorization request timed out." : "The authentication service did not finish loading."} Retry to reconnect without losing the VS Code authorization request.</p>
            <button type="button" onClick={() => window.location.reload()}>Retry sign in</button>
          </div>
        ) : isLoaded && isSignedIn && !hasCompassSession ? (
          <div className="compass-auth-status" role="status">
            <strong>{bootstrapError ? "Compass could not finish signing you in." : "Connecting your Compass workspace..."}</strong>
            <p>{bootstrapError || "Finishing the secure session before returning to the device authorization request."}</p>
            {bootstrapError ? <button type="button" onClick={() => window.location.reload()}>Retry sign in</button> : null}
          </div>
        ) : (
          <SignIn routing="hash" signUpUrl="/signup" appearance={{ elements: { rootBox: "compass-clerk-root", card: "compass-clerk-card" } }} />
        )}
      </section>
    </main>
  );
}
