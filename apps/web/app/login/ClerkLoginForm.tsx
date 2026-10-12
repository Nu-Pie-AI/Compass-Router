"use client";

import { SignIn, useAuth } from "@clerk/nextjs";
import { Compass } from "lucide-react";
import { useEffect, useState } from "react";

export default function ClerkLoginForm() {
  const { isLoaded } = useAuth();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = window.setTimeout(() => setTimedOut(true), 8000);
    return () => window.clearTimeout(timer);
  }, [isLoaded]);

  return (
    <main className="console-login">
      <section className="clerk-login-layout" aria-labelledby="login-title">
        <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
        <div className="console-login-copy"><span>WORKSPACE ACCESS</span><h1 id="login-title">Welcome back</h1><p>Sign in securely with your Compass account.</p></div>
        {timedOut ? (
          <div className="console-login-error" role="alert">
            Secure sign-in could not load. Check your connection to Clerk, then reload this page.
            <button className="console-primary" type="button" onClick={() => window.location.reload()}>Reload sign in</button>
          </div>
        ) : (
          <SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/portal" appearance={{ elements: { rootBox: "compass-clerk-root", card: "compass-clerk-card" } }} />
        )}
      </section>
    </main>
  );
}
