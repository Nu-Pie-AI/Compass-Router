"use client";

import { ArrowRight, LogIn, LogOut, Route, UserPlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const sessionKey = "compass.local.session";

function marketplaceUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "http://localhost:3100";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function LandingNav() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(window.localStorage.getItem(sessionKey)));
    const onStorage = () => setSignedIn(Boolean(window.localStorage.getItem(sessionKey)));
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function signOut() {
    window.localStorage.removeItem(sessionKey);
    window.location.assign(marketplaceUrl("/compass/logout"));
  }

  return (
    <nav className="marketing-nav" aria-label="Primary navigation">
      <Link className="brand-lockup" href="/" aria-label="Compass home">
        <span className="brand-mark"><Route aria-hidden="true" /></span>
        <span>Compass</span>
      </Link>
      <div className="marketing-links">
        <a href="#platform">Platform</a>
        <a href="#workflow">How it works</a>
        <Link href="/extension">VS Code</Link>
        <Link href="/models">Models</Link>
        <Link href="/pricing">Pricing</Link>
      </div>
      <div className="marketing-actions">
        {signedIn ? (
          <>
            <Link className="button button-quiet" href="/dashboard">Overview <ArrowRight aria-hidden="true" /></Link>
            <button className="button button-secondary" type="button" onClick={signOut}><LogOut aria-hidden="true" />Log out</button>
          </>
        ) : (
          <>
            <a className="button button-quiet" href={marketplaceUrl("/login?callbackUrl=/compass")}><LogIn aria-hidden="true" />Log in</a>
            <a className="button button-primary" href={marketplaceUrl("/signup?callbackUrl=/compass")}><UserPlus aria-hidden="true" />Sign up</a>
          </>
        )}
      </div>
    </nav>
  );
}
