import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { purgeOldLogs } from "@/lib/chatLogic";
import { serverError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const cutoff = await purgeOldLogs(userId);
    const logs = await prisma.chatLog.findMany({
      where: { userId, createdAt: { gte: cutoff } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ logs });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    await prisma.chatLog.deleteMany({ where: { userId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
