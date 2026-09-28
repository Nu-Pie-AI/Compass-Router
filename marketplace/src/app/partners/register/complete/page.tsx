"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, Loader2 } from "lucide-react";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

export default function CompletePartnerRegistrationPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/partners/register");
    }
  }, [router, status]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/partners/register/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to complete partner registration");
      }

      await update();
      toastSuccess("Partner account created", "Your application is awaiting admin approval.");
      router.push("/approval-pending");
    } catch (error) {
      toastError(
        "Registration failed",
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[var(--background)]">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Complete Partner Signup</h1>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Signed in as {session?.user?.email}. Add your company details to submit for approval.
          </p>
        </div>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <label htmlFor="companyName" className="mb-2 block text-sm font-medium text-[var(--muted-foreground)]">
              Company name
            </label>
            <input
              id="companyName"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              required
              minLength={2}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your Company Inc."
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || companyName.trim().length < 2}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-60"
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            Submit for Approval
          </button>
        </form>
      </div>
    </div>
  );
}
