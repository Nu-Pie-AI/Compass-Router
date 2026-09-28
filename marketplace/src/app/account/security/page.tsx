"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

type Status = {
  twoFactorEnabled: boolean;
  twoFactorMethod: "EMAIL" | "TOTP" | "BOTH" | null;
  backupCodesRemaining: number;
};

type Setup = {
  secret: string;
  qrCode: string;
};

export default function AccountSecurityPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [method, setMethod] = useState<"EMAIL" | "TOTP" | "BOTH">("EMAIL");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    const response = await fetch("/api/auth/2fa/status");
    if (response.ok) setStatus(await response.json());
  }

  useEffect(() => {
    loadStatus();
  }, []);

  async function startTotpSetup() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to start setup");
      setSetup(data);
    } catch (error) {
      toastError("Setup failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  async function enable() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/enable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method,
          secret: setup?.secret,
          code,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to enable 2FA");
      setBackupCodes(data.backupCodes || []);
      toastSuccess("Two-factor authentication enabled");
      await loadStatus();
    } catch (error) {
      toastError("Enable failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  async function disable() {
    setLoading(true);
    try {
      const response = await fetch("/api/auth/2fa/disable", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to disable 2FA");
      setSetup(null);
      setBackupCodes([]);
      toastSuccess("Two-factor authentication disabled");
      await loadStatus();
    } catch (error) {
      toastError("Disable failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Account security</h1>
        <p className="mt-2 text-[var(--muted-foreground)]">Manage two-factor authentication for your account.</p>

        <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--foreground)]">Two-factor authentication</h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Status: {status?.twoFactorEnabled ? `Enabled (${status.twoFactorMethod})` : "Disabled"}
              </p>
              {status?.twoFactorEnabled && (
                <p className="text-sm text-[var(--muted-foreground)]">
                  Backup codes remaining: {status.backupCodesRemaining}
                </p>
              )}
            </div>
            {status?.twoFactorEnabled && (
              <button
                type="button"
                onClick={disable}
                disabled={loading}
                className="rounded-lg border border-red-300 px-4 py-2 font-medium text-red-600 disabled:opacity-60"
              >
                Disable
              </button>
            )}
          </div>

          {!status?.twoFactorEnabled && (
            <div className="mt-6 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-[var(--muted-foreground)]">Method</label>
                <select
                  value={method}
                  onChange={(event) => {
                    const next = event.target.value as "EMAIL" | "TOTP" | "BOTH";
                    setMethod(next);
                    if (next === "TOTP" || next === "BOTH") startTotpSetup();
                  }}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                >
                  <option value="EMAIL">Email code</option>
                  <option value="TOTP">Authenticator app</option>
                  <option value="BOTH">Email + authenticator app</option>
                </select>
              </div>

              {(method === "TOTP" || method === "BOTH") && setup && (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-4">
                  <p className="mb-3 text-sm text-[var(--muted-foreground)]">Scan this QR code in your authenticator app.</p>
                  <Image src={setup.qrCode} alt="Authenticator QR code" width={180} height={180} />
                  <p className="mt-3 break-all text-xs text-[var(--muted-foreground)]">{setup.secret}</p>
                  <input
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    placeholder="Authenticator code"
                    className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
                  />
                </div>
              )}

              <button
                type="button"
                onClick={enable}
                disabled={loading || ((method === "TOTP" || method === "BOTH") && !code)}
                className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Saving..." : "Enable two-factor authentication"}
              </button>
            </div>
          )}

          {backupCodes.length > 0 && (
            <div className="mt-6 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <h3 className="font-semibold text-yellow-900">Save your backup codes</h3>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {backupCodes.map((backupCode) => (
                  <code key={backupCode} className="rounded bg-white px-3 py-2 text-sm text-yellow-900">
                    {backupCode}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
