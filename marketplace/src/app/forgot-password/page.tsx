"use client";

import { useState } from "react";
import Link from "next/link";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to send reset link");
      toastSuccess("Reset link sent", data.message);
    } catch (error) {
      toastError("Reset request failed", error instanceof Error ? error.message : "Please try again");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-[var(--foreground)]">Reset password</h1>
        <p className="mt-2 text-sm text-[var(--muted-foreground)]">
          Enter your account email and we will send a reset link.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-[var(--muted-foreground)]">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <Link href="/login" className="mt-5 block text-center text-sm font-medium text-blue-600 hover:underline">
          Back to login
        </Link>
      </div>
    </div>
  );
}
