import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { signToken } from "@/lib/serverAuth";
import { sanitizeUser, serverError } from "@/lib/apiHelpers";

export async function POST() {
  try {
    const user = await prisma.user.create({
      data: { isAnonymous: true },
    });

    const token = signToken(user.id);
    return NextResponse.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    return serverError(err);
  }
}

