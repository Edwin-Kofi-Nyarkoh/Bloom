import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { cycleSchema, validateCycle } from "@/lib/cycleRules";
import { serverError } from "@/lib/apiHelpers";

export async function GET(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  const cycles = await prisma.cycle.findMany({
    where: { userId },
    orderBy: { startDate: "desc" },
  });
  return NextResponse.json({ cycles });
}

export async function POST(req: NextRequest) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ error: "Missing or invalid auth token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = cycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please choose a start date." }, { status: 400 });
    }

    const checked = await validateCycle(userId, parsed.data);
    if ("error" in checked) {
      return NextResponse.json({ error: checked.error }, { status: checked.status });
    }

    const cycle = await prisma.cycle.create({
      data: {
        userId,
        startDate: new Date(checked.start),
        endDate: checked.end ? new Date(checked.end) : undefined,
      },
    });
    return NextResponse.json({ cycle }, { status: 201 });
  } catch (err) {
    return serverError(err);
  }
}
