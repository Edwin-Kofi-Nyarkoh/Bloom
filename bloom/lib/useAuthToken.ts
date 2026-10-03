"use client";

import { useSession } from "next-auth/react";
import { useStored } from "@/lib/browserStore";

/** The API token for the signed-in account, or for the guest session on this device. */
export function useAuthToken() {
  const { data } = useSession();
  const anonToken = useStored("bloom_anon_token");
  return data?.accessToken || anonToken;
}
