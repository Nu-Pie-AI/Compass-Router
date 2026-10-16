"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useState } from "react";
import { CheckCircle2, Compass, Laptop, ShieldCheck } from "lucide-react";
import { apiFetch } from "../../../lib/api";

type Session = { token: string; email: string };

export default function ExtensionAuthorizePage() {
  const { getToken, isLoaded: clerkLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [userCode] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("user_code") || "");
  const [session] = useState<Session | null>(() => {
    if (typeof window === "undefined") return null;
    const saved = window.localStorage.getItem("compass.local.session");
    if (!saved) return null;
    try { return JSON.parse(saved) as Session; }
    catch { window.localStorage.removeItem("compass.local.session"); return null; }
  });
  const [approved, setApproved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function approve() {
    if ((!session && (!clerkLoaded || !isSignedIn)) || !userCode) return;
    setBusy(true);
    setError("");
    try {
      const token = session?.token ?? await getToken();
      if (!token) throw new Error("Compass session token was not available.");
      await apiFetch("/auth/extension/device/approve", { method: "POST", body: JSON.stringify({ user_code: userCode }) }, token);
      setApproved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not authorize VS Code.");
    } finally {
      setBusy(false);
    }
  }

  const loginHref = `/login?callbackUrl=${encodeURIComponent(`/extension/authorize?user_code=${userCode}`)}`;
  const signedInEmail = session?.email ?? user?.primaryEmailAddress?.emailAddress ?? "your Compass account";
  const canAuthorize = Boolean(session || (clerkLoaded && isSignedIn));
  return <main className="console-login extension-authorize-page"><section className="console-login-panel" aria-labelledby="extension-auth-title">
    <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
    {approved ? <><div className="console-login-copy"><span>DEVICE AUTHORIZED</span><h1 id="extension-auth-title">VS Code is connected</h1><p>You can return to VS Code. It will finish signing in automatically. Choose the project in VS Code when you are ready to use it.</p></div><div className="account-empty"><CheckCircle2 /><strong>Authorization approved</strong><span>Account access granted. Project selection remains in VS Code.</span></div></> : !canAuthorize ? <><div className="console-login-copy"><span>COMPASS ROUTER EXTENSION</span><h1 id="extension-auth-title">Sign in to authorize VS Code</h1><p>Use your Compass account to approve this device. The code is <strong>{userCode || "missing"}</strong>.</p></div><a className="console-primary" href={loginHref}><Laptop size={17} /> Sign in to continue</a></> : <><div className="console-login-copy"><span>COMPASS ROUTER EXTENSION</span><h1 id="extension-auth-title">Authorize this VS Code device</h1><p>Signed in as {signedInEmail}. This connects VS Code to your Compass account. You will choose the project in VS Code.</p></div><p className="console-login-fixture"><ShieldCheck size={15} /> Account authorization is scoped to your signed-in Compass account. Project access is checked again for every request.</p>{error ? <p className="console-login-error" role="alert">{error}</p> : null}<button className="console-primary" type="button" disabled={busy || !userCode} onClick={() => void approve()}>{busy ? "Authorizing..." : "Authorize VS Code"}</button></>}
  </section></main>;
}
