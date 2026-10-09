"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignIn } from "@clerk/nextjs";
import { Compass, KeyRound, Mail } from "lucide-react";
import { apiFetch } from "../../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };

const clerkEnabled = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

function ClerkLogin() {
  return <main className="console-login"><section className="console-login-panel" aria-labelledby="login-title"><div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div><div className="console-login-copy"><span>WORKSPACE ACCESS</span><h1 id="login-title">Welcome back</h1><p>Sign in securely with your Compass account.</p></div><SignIn routing="hash" signUpUrl="/signup" fallbackRedirectUrl="/dashboard" /></section></main>;
}

function LegacyLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [mode, setMode] = useState<"password" | "otp">("password");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [debugOtp, setDebugOtp] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("compass.local.session");
    if (saved) router.replace("/dashboard");
  }, [router]);

  function finish(session: Session) {
    window.localStorage.setItem("compass.local.session", JSON.stringify(session));
    const callback = new URLSearchParams(window.location.search).get("callbackUrl") || "/dashboard";
    router.replace(callback.startsWith("/") ? callback : "/dashboard");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (mode === "password") {
        finish(await apiFetch<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email: email.trim(), password }) }));
      } else if (!challengeId) {
        const response = await apiFetch<{ challenge_id: string; debug_otp?: string }>("/auth/login/request-otp", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        setChallengeId(response.challenge_id);
        setDebugOtp(response.debug_otp || "");
      } else {
        finish(await apiFetch<Session>("/auth/login/verify-otp", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, email: email.trim(), code }) }));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="console-login"><section className="console-login-panel" aria-labelledby="login-title">
    <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
    <div className="console-login-copy"><span>WORKSPACE ACCESS</span><h1 id="login-title">Welcome back</h1><p>Sign in to manage projects, members, keys, and usage.</p></div>
    <div className="console-auth-mode" role="tablist"><button type="button" role="tab" aria-selected={mode === "password"} onClick={() => { setMode("password"); setChallengeId(""); }}>{"Password"}</button><button type="button" role="tab" aria-selected={mode === "otp"} onClick={() => setMode("otp")}>Email OTP</button></div>
    <form onSubmit={submit}>
      <label>Email address<input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      {mode === "password" ? <label>Password<input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label> : challengeId ? <label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value)} /></label> : null}
      {debugOtp ? <p className="console-login-fixture"><strong>Development OTP</strong>{debugOtp}</p> : null}
      {error ? <p className="console-login-error" role="alert">{error}</p> : null}
      <button className="console-primary" type="submit" disabled={busy}>{mode === "password" ? <KeyRound size={17} /> : <Mail size={17} />}{busy ? "Working..." : mode === "otp" && challengeId ? "Verify code" : mode === "otp" ? "Send code" : "Sign in"}</button>
    </form>
    <p className="console-login-fixture">New customer? <a href="/signup">Create an account</a></p>
  </section></main>;
}

export default function LoginPage() {
  return clerkEnabled ? <ClerkLogin /> : <LegacyLoginPage />;
}
