"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toastError, toastSuccess } from "@/lib/toast-helpers";

const signupSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

type SignupFormData = z.infer<typeof signupSchema>;
type LoginFormData = z.infer<typeof loginSchema>;

interface AuthFormProps {
  mode: "signup" | "login";
  callbackUrl?: string;
}

function SignupForm({ callbackUrl = "/" }: { callbackUrl?: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error || "Signup failed");
        toastError("Signup failed", result.error || "Please try again");
        setIsLoading(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email: data.email,
        password: data.password,
        callbackUrl,
        redirect: false,
      });

      if (signInResult?.error) {
        setServerError("Account created but login failed");
        toastError("Account created but login failed");
        setIsLoading(false);
        return;
      }

      const session = await fetch("/api/auth/session").then((res) =>
        res.json()
      );
      const role = session?.user?.role || "user";

      toastSuccess("Account created successfully");
      if (role === "admin") {
        router.push("/admin");
      } else if (role === "vendor") {
        router.push("/vendors/dashboard");
      } else {
        router.push(callbackUrl);
      }
    } catch (error) {
      setServerError("An unexpected error occurred");
      toastError("Signup failed", "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
      {serverError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Name
        </label>
        <input
          id="name"
          type="text"
          {...register("name")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.name && (
          <p className="text-red-600 text-sm mt-1">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register("password")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.password && (
          <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
        )}
      </div>

      <div>
        <label
          htmlFor="confirmPassword"
          className="block text-sm font-medium mb-1"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          {...register("confirmPassword")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.confirmPassword && (
          <p className="text-red-600 text-sm mt-1">
            {errors.confirmPassword.message}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? "Loading..." : "Sign Up"}
      </button>

      <OAuthButtons callbackUrl={callbackUrl} />
    </form>
  );
}

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        if (result.error.startsWith("TWO_FACTOR_REQUIRED")) {
          const [, challengeId, method, userId] = result.error.split(":");
          router.push(`/two-factor/verify?challengeId=${encodeURIComponent(challengeId || "")}&method=${encodeURIComponent(method || "TOTP")}&userId=${encodeURIComponent(userId || "")}`);
          return;
        }

        setServerError("Invalid email or password");
        toastError("Login failed", "Invalid email or password");
        setIsLoading(false);
        return;
      }

      const session = await fetch("/api/auth/session").then((res) =>
        res.json()
      );
      const role = session?.user?.role || "user";

      toastSuccess("Logged in successfully");
      if (role === "admin") {
        router.push("/admin");
      } else if (role === "vendor") {
        router.push("/vendors/dashboard");
      } else {
        router.push("/");
      }
    } catch (error) {
      setServerError("An unexpected error occurred");
      toastError("Login failed", "An unexpected error occurred");
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 w-full max-w-md">
      {serverError && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
          {serverError}
        </div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          {...register("email")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.email && (
          <p className="text-red-600 text-sm mt-1">{errors.email.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          type="password"
          {...register("password")}
          disabled={isLoading}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-[var(--background)]"
        />
        {errors.password && (
          <p className="text-red-600 text-sm mt-1">{errors.password.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {isLoading ? "Loading..." : "Log In"}
      </button>

      <OAuthButtons callbackUrl="/" />
    </form>
  );
}

function OAuthButtons({ callbackUrl }: { callbackUrl: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--border)]" />
        <span className="text-xs uppercase text-[var(--muted-foreground)]">or</span>
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl })}
        className="w-full rounded-md border border-[var(--border)] px-4 py-2 font-medium hover:bg-[var(--background)]"
      >
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => signIn("azure-ad", { callbackUrl })}
        className="w-full rounded-md border border-[var(--border)] px-4 py-2 font-medium hover:bg-[var(--background)]"
      >
        Continue with Microsoft
      </button>
    </div>
  );
}

export default function AuthForm({ mode, callbackUrl = "/" }: AuthFormProps) {
  return mode === "signup" ? <SignupForm callbackUrl={callbackUrl} /> : <LoginForm />;
}
