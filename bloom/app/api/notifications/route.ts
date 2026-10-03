import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { serverError } from "@/lib/apiHelpers";

const notificationSchema = z.object({
  type: z.enum(["PERIOD_START", "PERIOD_END", "FERTILITY_WINDOW", "SYMPTOM_REMINDER"]),
  scheduledFor: z.string(),
  delivered: z.boolean().optional(),
});

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { scheduledFor: "asc" },
  });
  return NextResponse.json({ notifications });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = notificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: parsed.data.type,
        scheduledFor: new Date(parsed.data.scheduledFor),
        delivered: parsed.data.delivered ?? false,
      },
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}

