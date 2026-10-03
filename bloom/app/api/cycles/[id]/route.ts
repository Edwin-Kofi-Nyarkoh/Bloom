import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUserId } from "@/lib/serverAuth";
import { cycleSchema, validateCycle } from "@/lib/cycleRules";
import { serverError } from "@/lib/apiHelpers";

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
    const parsed = cycleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Please choose a start date." }, { status: 400 });
    }

    const existing = await prisma.cycle.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    const checked = await validateCycle(userId, parsed.data, existing.id);
    if ("error" in checked) {
      return NextResponse.json({ error: checked.error }, { status: checked.status });
    }

    const cycle = await prisma.cycle.update({
      where: { id: existing.id },
      data: {
        startDate: new Date(checked.start),
        endDate: checked.end ? new Date(checked.end) : null,
      },
    });

    return NextResponse.json({ cycle });
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
    const existing = await prisma.cycle.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
    }

    await prisma.cycle.delete({ where: { id: existing.id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return serverError(err);
  }
}
