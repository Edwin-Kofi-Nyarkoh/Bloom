import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { addDays, toKey } from "../lib/dates";

// The one test account. Seeding only ever touches this user, so real accounts
// are left alone, and every newly registered account starts completely empty.
const DEMO_EMAIL = "demo@bloom.app";
const DEMO_PASSWORD = "Password123!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { passwordHash, isAnonymous: false },
    create: { email: DEMO_EMAIL, passwordHash, isAnonymous: false },
  });

  await prisma.chatLog.deleteMany({ where: { userId: demo.id } });
  await prisma.notification.deleteMany({ where: { userId: demo.id } });
  await prisma.symptom.deleteMany({ where: { userId: demo.id } });
  await prisma.cycle.deleteMany({ where: { userId: demo.id } });

  // Dates are relative to today so the demo always looks current:
  // the latest period started 9 days ago, with five full cycles before it.
  const today = toKey(new Date());
  const cycleLengths = [28, 27, 29, 28, 27];
  const periodLengths = [5, 5, 4, 5, 5, 5];
  const starts = [addDays(today, -9)];
  [...cycleLengths].reverse().forEach((length) => starts.unshift(addDays(starts[0], -length)));

  await prisma.cycle.createMany({
    data: starts.map((start, index) => ({
      userId: demo.id,
      startDate: new Date(start),
      endDate: new Date(addDays(start, periodLengths[index] - 1)),
    })),
  });

  // [cycle index, day of cycle, mood, cramps, sleep, energy, notes]
  const entries: Array<[number, number, string, number, number, number, string?]> = [
    [3, 1, "Crampy", 4, 3, 2, "Rough first day, stayed in with a hot water bottle."],
    [3, 3, "Tired", 3, 3, 2],
    [3, 9, "Energetic", 1, 4, 5, "Great run this morning."],
    [3, 14, "Happy", 1, 4, 4],
    [3, 21, "Calm", 1, 4, 3],
    [3, 26, "Moody", 2, 2, 2, "Snapped at everyone today."],
    [4, 1, "Crampy", 4, 2, 2],
    [4, 2, "Tired", 3, 3, 2, "Low energy, early night."],
    [4, 8, "Happy", 1, 5, 4],
    [4, 13, "Loved", 1, 4, 5],
    [4, 20, "Calm", 1, 4, 3],
    [4, 25, "Cravings", 2, 3, 3, "All the chocolate."],
    [4, 26, "Sensitive", 2, 2, 2],
    [5, 1, "Crampy", 3, 3, 2],
    [5, 2, "Tired", 3, 3, 3],
    [5, 5, "Calm", 1, 4, 3],
    [5, 8, "Energetic", 1, 4, 5],
  ];

  await prisma.symptom.createMany({
    data: entries.map(([cycle, day, mood, cramps, sleep, energy, notes]) => ({
      userId: demo.id,
      date: new Date(addDays(starts[cycle], day - 1)),
      mood,
      cramps,
      sleep,
      energy,
      notes,
    })),
  });

  await prisma.notification.createMany({
    data: [
      { userId: demo.id, type: "PERIOD_START", scheduledFor: new Date(`${addDays(starts[5], 27)}T08:00:00Z`) },
      { userId: demo.id, type: "FERTILITY_WINDOW", scheduledFor: new Date(`${addDays(starts[5], 8)}T08:00:00Z`) },
    ],
  });

  const now = Date.now();
  await prisma.chatLog.createMany({
    data: [
      { userId: demo.id, role: "USER", message: "What helps with cramps?", createdAt: new Date(now - 60_000) },
      {
        userId: demo.id,
        role: "ASSISTANT",
        message:
          "Sorry you're in pain. 💗 Heat on your lower tummy, gentle stretching, and ibuprofen (following the pack) usually help the most. If the pain ever stops you doing normal things, it's worth seeing a doctor.",
        createdAt: new Date(now - 59_000),
      },
    ],
  });

  console.log(`Seeded demo account ${DEMO_EMAIL} (password ${DEMO_PASSWORD}). No other accounts were changed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
