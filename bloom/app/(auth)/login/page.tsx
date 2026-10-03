"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import api, { apiErrorMessage } from "@/lib/api";
import { writeStored } from "@/lib/browserStore";
import { useState } from "react";
import AuthShell from "@/components/layout/AuthShell";

type LoginForm = { email: string; password: string };

export default function LoginPage() {
  const { register, handleSubmit } = useForm<LoginForm>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnonLoading, setIsAnonLoading] = useState(false);

  const onSubmit = async (values: LoginForm) => {
    setError(null);
    setIsLoading(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.ok && !result.error) {
        // A signed-in account replaces any guest session on this device.
        writeStored("bloom_anon_token", null);
        window.location.assign("/dashboard");
      } else if (result?.error === "CredentialsSignin") {
        setError("That email or password isn't right. Please try again.");
      } else {
        setError("We couldn't reach the server just now. Please try again in a moment.");
      }
    } catch {
      setError("We couldn't reach the server just now. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAnonymous = async () => {
    setError(null);
    setIsAnonLoading(true);
    try {
      const response = await api.post("/auth/anonymous");
      if (response.data?.token) {
        writeStored("bloom_anon_token", response.data.token);
        window.location.assign("/dashboard");
      } else {
        setError("Couldn't start guest mode. Please try again.");
      }
    } catch (err) {
      console.error("Anonymous login error:", err);
      setError(apiErrorMessage(err, "Couldn't reach the server. Please try again."));
    } finally {
      setIsAnonLoading(false);
    }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to see your cycle.">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Email</span>
          <input
            {...register("email", { required: true })}
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="field"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-bold text-ink">Password</span>
          <input
            {...register("password", { required: true })}
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            className="field"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={isLoading || isAnonLoading} className="btn btn-primary w-full">
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
        <button type="button" disabled={isLoading || isAnonLoading} onClick={handleAnonymous} className="btn btn-ghost w-full">
          {isAnonLoading ? "Starting..." : "Try without an account"}
        </button>
        <p className="pt-2 text-center text-sm text-muted">
          New here?{" "}
          <Link href="/signup" className="font-extrabold text-primary-ink">
            Create an account
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
