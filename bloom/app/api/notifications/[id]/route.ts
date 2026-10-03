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

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const body = await req.json();
    const parsed = notificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const notification = await prisma.notification.update({
      where: { id: existing.id },
      data: {
        type: parsed.data.type,
        scheduledFor: new Date(parsed.data.scheduledFor),
        delivered: parsed.data.delivered ?? false,
      },
    });

    return NextResponse.json({ notification });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const { id } = await context.params;

  try {
    const existing = await prisma.notification.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

