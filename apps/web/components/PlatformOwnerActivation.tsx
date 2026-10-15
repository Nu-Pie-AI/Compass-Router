"use client";

import { useState } from "react";
import { apiFetch } from "../lib/api";

type Session = { portal?: string };

export function PlatformOwnerActivation() {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/admin/bootstrap", {
        method: "POST",
        body: JSON.stringify({ confirmation: "BOOTSTRAP_PLATFORM_OWNER" }),
      });
      const session = await apiFetch<Session>("/auth/clerk/bootstrap", { method: "POST" });
      window.localStorage.setItem("compass.local.session", JSON.stringify(session));
      window.location.replace("/portal");
    } catch {
      setBusy(false);
      setConfirming(false);
      setError("Activation could not be completed. Refresh and try again, or contact a platform administrator.");
    }
  };

  return (
    <main className="console-auth-loading" aria-labelledby="platform-owner-title">
      <section className="platform-owner-activation">
        <p className="platform-owner-eyebrow">PLATFORM OWNER SETUP</p>
        <h1 id="platform-owner-title">Activate Platform Owner</h1>
        <p>Your verified account is authorized for the one-time platform owner activation.</p>
        <p>This grants platform-wide administrative privileges, including provider, access, and operational settings.</p>
        {error ? <p className="dialog-error" role="alert">{error}</p> : null}
        <button className="console-primary" type="button" disabled={busy} onClick={() => { setError(null); setConfirming(true); }}>
          Activate Platform Owner
        </button>
      </section>
      {confirming ? (
        <div className="platform-owner-confirm" role="dialog" aria-modal="true" aria-labelledby="platform-owner-confirm-title">
          <div className="console-dialog platform-owner-confirm-dialog">
            <h2 id="platform-owner-confirm-title">Confirm platform-wide access</h2>
            <p>Continue only if you are the intended platform owner. This one-time action grants platform-wide administrative privileges.</p>
            <div className="dialog-footer">
              <button className="console-secondary" type="button" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
              <button className="console-primary" type="button" disabled={busy} onClick={() => void activate()}>{busy ? "Activating..." : "Confirm activation"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
