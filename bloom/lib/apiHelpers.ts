import { NextResponse } from "next/server";

/** Logs the real error on the server and sends the user a plain message without internal details. */
export function serverError(error: unknown) {
  console.error("API error:", error);
  return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
}

/** Removes the password hash before a user record is sent to the browser. */
export function sanitizeUser<T extends { passwordHash?: string | null }>(user: T): Omit<T, "passwordHash"> {
  const safeUser: Partial<T> = { ...user };
  delete safeUser.passwordHash;
  return safeUser as Omit<T, "passwordHash">;
}
