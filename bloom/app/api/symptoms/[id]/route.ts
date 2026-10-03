import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { serverError } from "@/lib/apiHelpers";

const symptomSchema = z.object({
  date: z.string(),
  mood: z.string().optional(),
  cramps: z.number().min(1).max(5).optional(),
  sleep: z.number().min(1).max(5).optional(),
  energy: z.number().min(1).max(5).optional(),
  notes: z.string().optional(),
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
    const parsed = symptomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const existing = await prisma.symptom.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Symptom not found" }, { status: 404 });
    }

    const symptom = await prisma.symptom.update({
      where: { id: existing.id },
      data: {
        date: new Date(parsed.data.date),
        mood: parsed.data.mood,
        cramps: parsed.data.cramps,
        sleep: parsed.data.sleep,
        energy: parsed.data.energy,
        notes: parsed.data.notes,
      },
    });

    return NextResponse.json({ symptom });
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
    const existing = await prisma.symptom.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Symptom not found" }, { status: 404 });
    }

    await prisma.symptom.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}

