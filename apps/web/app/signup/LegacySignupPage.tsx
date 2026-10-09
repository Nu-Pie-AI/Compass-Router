"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Compass, Mail } from "lucide-react";
import { apiFetch } from "../../lib/api";

type Session = { token: string; user_id: string; email: string; organization_id?: string | null; role: string };

export default function LegacySignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [debugOtp, setDebugOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (!challengeId) {
        const response = await apiFetch<{ challenge_id: string; debug_otp?: string }>("/auth/signup/request-otp", { method: "POST", body: JSON.stringify({ email: email.trim() }) });
        setChallengeId(response.challenge_id);
        setDebugOtp(response.debug_otp || "");
      } else {
        const session = await apiFetch<Session>("/auth/signup/verify-otp", { method: "POST", body: JSON.stringify({ challenge_id: challengeId, email: email.trim(), code, organization_name: organizationName.trim() }) });
        window.localStorage.setItem("compass.local.session", JSON.stringify(session));
        router.replace("/dashboard");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create your account.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="console-login"><section className="console-login-panel" aria-labelledby="signup-title">
    <div className="console-login-brand"><Compass size={24} aria-hidden="true" />Compass Router</div>
    <div className="console-login-copy"><span>NEW CUSTOMER</span><h1 id="signup-title">Create your workspace</h1><p>Verify your email, name your organization, and start with a project-ready Compass account.</p></div>
    <form onSubmit={submit}>
      <label>Email address<input required type="email" autoComplete="email" value={email} disabled={Boolean(challengeId)} onChange={(event) => setEmail(event.target.value)} /></label>
      {challengeId ? <label>Organization name<input required minLength={2} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} /></label> : null}
      {challengeId ? <label>Verification code<input required inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value)} /></label> : null}
      {debugOtp ? <p className="console-login-fixture"><strong>Development OTP</strong>{debugOtp}</p> : null}
      {error ? <p className="console-login-error" role="alert">{error}</p> : null}
      <button className="console-primary" type="submit" disabled={busy}>{challengeId ? <Building2 size={17} /> : <Mail size={17} />}{busy ? "Working..." : challengeId ? "Create workspace" : "Email me a code"}</button>
    </form>
    <p className="console-login-fixture">Already have an account? <a href="/login">Sign in</a></p>
  </section></main>;
}
