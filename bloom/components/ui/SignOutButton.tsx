"use client";

import { signOut } from "next-auth/react";
import { writeStored } from "@/lib/browserStore";

export default function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => {
        writeStored("bloom_anon_token", null);
        signOut({ callbackUrl: "/login" });
      }}
      className="btn btn-ghost w-full"
    >
      Sign out
    </button>
  );
}
