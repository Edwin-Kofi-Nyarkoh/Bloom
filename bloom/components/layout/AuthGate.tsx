"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";

/** Sends visitors who are neither signed in nor in guest mode to the login screen. */
export default function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated" && !localStorage.getItem("bloom_anon_token")) {
      router.replace("/login");
    }
  }, [status, router]);

  return <>{children}</>;
}
