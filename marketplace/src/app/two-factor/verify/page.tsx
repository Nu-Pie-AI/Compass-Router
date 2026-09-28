"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

export default function TwoFactorVerifyPage() {
  return (
    <Suspense fallback={null}>
      <TwoFactorVerifyForm />
    </Suspense>
  );
}

function TwoFactorVerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const challengeId = searchParams.get("challengeId") || "";
  const method = searchParams.get("method") || "TOTP";
  const userId = searchParams.get("userId") || "";
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        redirect: false,
        challengeId,
        userId,
        twoFactorMethod: method,
        twoFactorCode: code,
        backupCode,
      });

      if (result?.error) throw new Error("Invalid verification code");

      toastSuccess("Verification complete");
      router.push("/");
    } catch (error) {
      toastError("Verification failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Two-factor verification</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          {method === "EMAIL"
            ? "Enter the code we sent to your email."
            : "Enter your authenticator app code, or use a backup code."}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder={method === "EMAIL" ? "Email code" : "Authenticator code"}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {method !== "EMAIL" && (
            <input
              value={backupCode}
              onChange={(event) => setBackupCode(event.target.value)}
              placeholder="Backup code"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
          <button
            type="submit"
            disabled={loading || (!code && !backupCode)}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Verifying..." : "Verify"}
          </button>
        </form>
      </div>
    </div>
  );
}
