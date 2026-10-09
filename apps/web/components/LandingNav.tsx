"use client";

import { ArrowRight, LogIn, LogOut, Route, Store, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch, signOutClerkSession } from "../lib/api";

const sessionKey = "compass.local.session";

function marketplaceUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_MARKETPLACE_URL ?? "http://localhost:3100";
  return `${base.replace(/\/$/, "")}${path}`;
}

export function LandingNav() {
  const [signedIn, setSignedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const syncSession = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("signedOut") === "1") {
        window.localStorage.removeItem(sessionKey);
        params.delete("signedOut");
        const query = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
      }

      const saved = window.localStorage.getItem(sessionKey);
      if (!saved) {
        if (active) setSignedIn(false);
        return;
      }

      try {
        const session = JSON.parse(saved) as { token?: string };
        if (!session.token) throw new Error("Missing Compass session token.");
        await apiFetch("/me", {}, session.token);
        if (active) setSignedIn(true);
      } catch {
        window.localStorage.removeItem(sessionKey);
        if (active) setSignedIn(false);
      }
    };

    void syncSession();
    const onStorage = () => setSignedIn(Boolean(window.localStorage.getItem(sessionKey)));
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  async function signOut() {
    const saved = window.localStorage.getItem(sessionKey);
    if (saved) {
      try {
        const session = JSON.parse(saved) as { token?: string };
        if (session.token) await apiFetch("/auth/logout", { method: "POST" }, session.token);
      } catch { /* local cleanup still signs the browser out */ }
    }
    try { await signOutClerkSession(); } catch { /* local cleanup still signs the browser out */ }
    window.localStorage.removeItem(sessionKey);
    router.push("/");
  }

  return (
    <nav className="marketing-nav" aria-label="Primary navigation">
      <Link className="brand-lockup" href="/" aria-label="Compass home">
        <span className="brand-mark"><Route aria-hidden="true" /></span>
        <span>Compass</span>
      </Link>
      <div className="marketing-links">
        <Link href={signedIn ? "/dashboard" : "/"}>Home</Link>
        <a href="#platform">Platform</a>
        <a href="#workflow">How it works</a>
        <Link href="/extension">VS Code</Link>
        <Link href="/models">Models</Link>
        <Link href="/pricing">Pricing</Link>
      </div>
      <div className="marketing-actions">
        <a className="button button-secondary marketplace-return-button" href={marketplaceUrl("/")}><Store aria-hidden="true" />Marketplace</a>
        {signedIn ? (
          <>
            <Link className="button button-quiet" href="/dashboard">Overview <ArrowRight aria-hidden="true" /></Link>
            <button className="button button-secondary" type="button" onClick={signOut}><LogOut aria-hidden="true" />Log out</button>
          </>
        ) : (
          <>
            <Link className="button button-quiet" href="/login"><LogIn aria-hidden="true" />Log in</Link>
            <Link className="button button-primary" href="/signup"><UserPlus aria-hidden="true" />Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
