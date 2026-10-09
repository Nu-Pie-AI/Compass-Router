"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { Compass, LockKeyhole } from "lucide-react";

import { apiFetch } from "../../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };
const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkAdminLogin() {
  return <main className="console-login"><section className="console-login-panel" aria-labelledby="admin-login-title"><div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div><div className="console-login-copy"><span>ROUTER ADMINISTRATION</span><h1 id="admin-login-title">Administrator sign in</h1><p>Authenticate with the configured Clerk staging instance.</p></div><SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/admin" /></section></main>;
}

function LegacyAdminLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const session = await apiFetch<Session>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      await apiFetch("/admin/access", {}, session.token);
      window.localStorage.setItem("compass.local.session", JSON.stringify(session));
      router.replace("/admin");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Administrator sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="console-login">
      <section className="console-login-panel" aria-labelledby="admin-login-title">
        <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass</div>
        <div className="console-login-copy">
          <span>ROUTER ADMINISTRATION</span>
          <h1 id="admin-login-title">Administrator sign in</h1>
          <p>Use the Compass Router administrator account to manage providers, models, teams, and operations.</p>
        </div>
        <form onSubmit={submit}>
          <label>Email address<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error ? <p className="console-login-error" role="alert">{error}</p> : null}
          <button className="console-primary" type="submit" disabled={busy}><LockKeyhole size={17} />{busy ? "Signing in..." : "Sign in as administrator"}</button>
        </form>
      </section>
    </main>
  );
}

export default function AdminLoginPage() {
  return clerkEnabled ? <ClerkAdminLogin /> : <LegacyAdminLogin />;
}
