import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { addDays, isDateKey, toKey } from "@/lib/dates";
import { serverError } from "@/lib/apiHelpers";

const symptomSchema = z.object({
  date: z.string(),
  mood: z.string().max(40).nullish(),
  cramps: z.number().min(1).max(5).nullish(),
  sleep: z.number().min(1).max(5).nullish(),
  energy: z.number().min(1).max(5).nullish(),
  notes: z.string().max(1000).nullish(),
});

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const symptoms = await prisma.symptom.findMany({
    where: { userId },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ symptoms });
}

// One entry per day: logging again for the same day updates that day's entry.
// Fields left out are kept; fields sent as null are cleared.
export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = symptomSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const day = toKey(parsed.data.date);
    if (!isDateKey(day)) {
      return NextResponse.json({ error: "That date doesn't look right." }, { status: 400 });
    }

    const { mood, cramps, sleep, energy, notes } = parsed.data;
    const fields = { mood, cramps, sleep, energy, notes: notes === undefined ? undefined : notes?.trim() || null };

    const existing = await prisma.symptom.findFirst({
      where: { userId, date: { gte: new Date(day), lt: new Date(addDays(day, 1)) } },
      orderBy: { createdAt: "desc" },
    });

    const symptom = existing
      ? await prisma.symptom.update({ where: { id: existing.id }, data: fields })
      : await prisma.symptom.create({ data: { userId, date: new Date(day), ...fields } });

    return NextResponse.json({ symptom }, { status: existing ? 200 : 201 });
  } catch (err) {
    return serverError(err);
  }
}
