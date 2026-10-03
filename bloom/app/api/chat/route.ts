import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { purgeOldLogs } from "@/lib/chatLogic";
import { askBloom } from "@/lib/bloomAI";
import { predictCycle } from "@/lib/predictor";
import { isDateKey, toKey } from "@/lib/dates";
import { serverError } from "@/lib/apiHelpers";

const chatSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  // The user's local date, so "today" matches her phone rather than the server.
  today: z.string().optional(),
});

const HISTORY_TURNS = 16;

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    await purgeOldLogs(userId);
    const { message } = parsed.data;
    const today = parsed.data.today && isDateKey(parsed.data.today) ? parsed.data.today : toKey(new Date());

    const [cycles, symptoms, logs] = await Promise.all([
      prisma.cycle.findMany({ where: { userId }, orderBy: { startDate: "asc" } }),
      prisma.symptom.findMany({ where: { userId }, orderBy: { date: "desc" } }),
      prisma.chatLog.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: HISTORY_TURNS }),
    ]);

    const { reply, source } = await askBloom({
      message,
      history: logs.reverse().map((log) => ({ role: log.role, message: log.message })),
      cycles,
      symptoms,
      prediction: predictCycle(cycles, today),
      today,
    });

    const now = Date.now();
    await prisma.chatLog.createMany({
      data: [
        { userId, role: "USER", message, createdAt: new Date(now) },
        { userId, role: "ASSISTANT", message: reply, createdAt: new Date(now + 1) },
      ],
    });

    return NextResponse.json({ reply, source });
  } catch (err) {
    return serverError(err);
  }
}
