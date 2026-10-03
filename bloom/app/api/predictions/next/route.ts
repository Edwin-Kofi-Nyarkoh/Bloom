import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { predictCycle, topMoods } from "@/lib/predictor";
import { isDateKey, toKey } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const requested = req.nextUrl.searchParams.get("today");
  const today = requested && isDateKey(requested) ? requested : toKey(new Date());

  const cycles = await prisma.cycle.findMany({ where: { userId } });
  const symptoms = await prisma.symptom.findMany({ where: { userId } });

  // cyclePrediction is null until the user logs her first period.
  return NextResponse.json({
    cyclePrediction: predictCycle(cycles, today),
    symptomPrediction: { commonMood: topMoods(symptoms, 1)[0]?.mood ?? null },
  });
}
