"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { signIn } from "next-auth/react";
import api, { apiErrorMessage } from "@/lib/api";
import { writeStored } from "@/lib/browserStore";
import { useState } from "react";
import AuthShell from "@/components/layout/AuthShell";

type SignupForm = { email: string; password: string };

export default function SignupPage() {
  const { register, handleSubmit } = useForm<SignupForm>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (values: SignupForm) => {
    setError(null);
    if (values.password.length < 6) {
      setError("Please use a password with at least 6 characters.");
      return;
    }
    setIsLoading(true);
    try {
      await api.post("/auth/register", values);
      // Sign straight in so a new user lands on her own empty Home screen.
      const result = await signIn("credentials", { ...values, redirect: false });
      writeStored("bloom_anon_token", null);
      window.location.assign(result?.ok ? "/dashboard" : "/login");
    } catch (err) {
      console.error("Signup error:", err);
      const message = apiErrorMessage(err, "Couldn't create your account. Check your email address and try again.");
      setError(message === "Email already in use" ? "That email already has an account. Try signing in instead." : message);
      setIsLoading(false);
    }
  };

  return (
    <AuthShell title="Create your account" subtitle="It takes less than a minute.">
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
            autoComplete="new-password"
            placeholder="At least 6 characters"
            className="field"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm font-bold text-danger">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={isLoading} className="btn btn-primary w-full">
          {isLoading ? "Creating your account..." : "Create account"}
        </button>
        <p className="pt-2 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-extrabold text-primary-ink">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}
