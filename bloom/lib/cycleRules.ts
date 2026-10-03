import { z } from "zod";
import { prisma } from "./prisma";
import { addDays, diffDays, formatKey, isDateKey, toKey } from "./dates";

export const cycleSchema = z.object({
  startDate: z.string(),
  endDate: z.string().nullish(),
});

// Two period starts closer than this are almost certainly the same period logged twice.
const MIN_GAP_DAYS = 10;

/** Checks a period's dates and returns either clean values or a message for the user. */
export async function validateCycle(
  userId: string,
  input: z.infer<typeof cycleSchema>,
  ignoreId?: string
): Promise<{ error: string; status: number } | { start: string; end: string | null }> {
  const start = toKey(input.startDate);
  const end = input.endDate ? toKey(input.endDate) : null;

  if (!isDateKey(start) || (end && !isDateKey(end))) {
    return { error: "That date doesn't look right. Please pick it again.", status: 400 };
  }
  // One day of leeway covers users whose local date is ahead of the server's.
  if (start > addDays(toKey(new Date()), 1)) {
    return { error: "A period can't start in the future. Pick today or an earlier day.", status: 400 };
  }
  if (end && (end < start || diffDays(start, end) > 14)) {
    return { error: "The end date should be on or after the start date, within two weeks.", status: 400 };
  }

  const nearby = await prisma.cycle.findFirst({
    where: {
      userId,
      startDate: { gte: new Date(addDays(start, -MIN_GAP_DAYS)), lte: new Date(addDays(start, MIN_GAP_DAYS)) },
      ...(ignoreId ? { NOT: { id: ignoreId } } : {}),
    },
  });
  if (nearby) {
    return {
      error: `You already logged a period starting ${formatKey(toKey(nearby.startDate))}. Edit that one instead.`,
      status: 409,
    };
  }

  return { start, end };
}
