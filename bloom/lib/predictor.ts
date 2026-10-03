import { DateKey, addDays, diffDays, toKey } from "./dates";

export type CycleLike = { id?: string; startDate: string | Date; endDate?: string | Date | null };
export type SymptomLike = {
  date: string | Date;
  mood?: string | null;
  cramps?: number | null;
  sleep?: number | null;
  energy?: number | null;
  notes?: string | null;
};

export type Phase = "period" | "follicular" | "fertile" | "ovulation" | "luteal" | "pms";
export type Chance = "low" | "medium" | "high" | "peak";
export type Confidence = "low" | "medium" | "high";

export type Prediction = {
  today: DateKey;
  cycleDay: number;
  cycleLength: number;
  periodLength: number;
  /** Lengths of past cycles, oldest first (only plausible ones). */
  history: number[];
  /** How much cycle length varies, in days (standard deviation). */
  variation: number;
  confidence: Confidence;
  lastPeriodStart: DateKey;
  onPeriod: boolean;
  nextPeriodStart: DateKey;
  nextPeriodEarliest: DateKey;
  nextPeriodLatest: DateKey;
  daysUntilNextPeriod: number;
  /** Days past the expected start with no new period logged. */
  daysLate: number;
  /** True when the last logged period is so old that estimates are not useful. */
  stale: boolean;
  ovulationDay: number;
  ovulationDate: DateKey;
  fertileStart: DateKey;
  fertileEnd: DateKey;
  /** The fertile window the user should look at next (this cycle's, or next cycle's if it passed). */
  upcomingFertile: { start: DateKey; end: DateKey; ovulation: DateKey } | null;
  phase: Phase;
  chance: Chance;
  segments: PhaseSegment[];
};

export type PhaseSegment = { phase: Exclude<Phase, "ovulation" | "pms">; startDay: number; endDay: number };

const DEFAULT_CYCLE = 28;
const DEFAULT_PERIOD = 5;
const LUTEAL_DAYS = 14;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/** Cycle lengths between consecutive period starts, ignoring gaps that look like missed logs. */
export function cycleLengths(cycles: CycleLike[]) {
  const starts = cycles.map((cycle) => toKey(cycle.startDate)).sort();
  const lengths: number[] = [];
  for (let i = 1; i < starts.length; i += 1) {
    const length = diffDays(starts[i - 1], starts[i]);
    if (length >= 15 && length <= 60) lengths.push(length);
  }
  return lengths;
}

function averagePeriodLength(cycles: CycleLike[]) {
  const lengths = cycles
    .filter((cycle) => cycle.endDate)
    .map((cycle) => diffDays(toKey(cycle.startDate), toKey(cycle.endDate as string | Date)) + 1)
    .filter((length) => length >= 1 && length <= 10);
  if (!lengths.length) return DEFAULT_PERIOD;
  return Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length);
}

function buildSegments(cycleLength: number, periodLength: number, ovulationDay: number): PhaseSegment[] {
  const fertileStart = Math.max(1, ovulationDay - 5);
  const fertileEnd = Math.min(cycleLength, ovulationDay + 1);
  const periodEnd = Math.min(periodLength, fertileStart - 1);
  const segments: PhaseSegment[] = [];
  if (periodEnd >= 1) segments.push({ phase: "period", startDay: 1, endDay: periodEnd });
  if (fertileStart - 1 > periodEnd) {
    segments.push({ phase: "follicular", startDay: periodEnd + 1, endDay: fertileStart - 1 });
  }
  segments.push({ phase: "fertile", startDay: fertileStart, endDay: fertileEnd });
  if (fertileEnd < cycleLength) {
    segments.push({ phase: "luteal", startDay: fertileEnd + 1, endDay: cycleLength });
  }
  return segments;
}

/**
 * Estimates where the user is in her cycle. Returns null when no period has been
 * logged yet, so a brand-new account never sees made-up numbers.
 */
export function predictCycle(cycles: CycleLike[], today: DateKey): Prediction | null {
  if (!cycles.length) return null;

  const sorted = [...cycles].sort((a, b) => toKey(a.startDate).localeCompare(toKey(b.startDate)));
  const past = sorted.filter((cycle) => toKey(cycle.startDate) <= today);
  const current = past.length ? past[past.length - 1] : sorted[0];
  const lastPeriodStart = toKey(current.startDate);

  // Recent cycles count more than old ones, so the estimate follows a changing rhythm.
  const history = cycleLengths(sorted);
  const recent = history.slice(-6);
  let cycleLength = DEFAULT_CYCLE;
  let variation = 0;
  if (recent.length) {
    const weightTotal = recent.reduce((sum, _, index) => sum + index + 1, 0);
    const weighted = recent.reduce((sum, value, index) => sum + value * (index + 1), 0) / weightTotal;
    cycleLength = clamp(Math.round(weighted), 21, 45);
    const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
    variation = Math.sqrt(recent.reduce((sum, value) => sum + (value - mean) ** 2, 0) / recent.length);
  }

  let confidence: Confidence = "low";
  if (recent.length >= 3 && variation <= 2.5) confidence = "high";
  else if (recent.length >= 2 && variation <= 5) confidence = "medium";
  const windowDays = recent.length ? clamp(Math.round(variation) + 1, 1, 5) : 3;

  const periodLength = averagePeriodLength(sorted);
  const cycleDay = Math.max(1, diffDays(lastPeriodStart, today) + 1);

  const nextPeriodStart = addDays(lastPeriodStart, cycleLength);
  const daysUntilNextPeriod = Math.max(0, diffDays(today, nextPeriodStart));
  const daysLate = Math.max(0, diffDays(nextPeriodStart, today));
  const stale = daysLate > 21;

  const ovulationDay = Math.max(cycleLength - LUTEAL_DAYS, 8);
  const ovulationDate = addDays(lastPeriodStart, ovulationDay - 1);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);

  let upcomingFertile: Prediction["upcomingFertile"] = null;
  if (fertileEnd >= today) {
    upcomingFertile = { start: fertileStart, end: fertileEnd, ovulation: ovulationDate };
  } else if (daysLate === 0) {
    const nextOvulation = addDays(nextPeriodStart, ovulationDay - 1);
    upcomingFertile = {
      start: addDays(nextOvulation, -5),
      end: addDays(nextOvulation, 1),
      ovulation: nextOvulation,
    };
  }

  const currentEnd = current.endDate ? toKey(current.endDate) : null;
  const onPeriod = currentEnd ? today <= currentEnd : cycleDay <= periodLength;

  let chance: Chance = "low";
  if (cycleDay === ovulationDay) chance = "peak";
  else if (cycleDay >= ovulationDay - 5 && cycleDay < ovulationDay) chance = "high";
  else if (cycleDay === ovulationDay + 1) chance = "medium";

  let phase: Phase = "luteal";
  if (onPeriod) phase = "period";
  else if (chance === "peak") phase = "ovulation";
  else if (chance === "high" || chance === "medium") phase = "fertile";
  else if (cycleDay < ovulationDay) phase = "follicular";
  else if (cycleDay > cycleLength - 5) phase = "pms";

  return {
    today,
    cycleDay,
    cycleLength,
    periodLength,
    history,
    variation: Math.round(variation * 10) / 10,
    confidence,
    lastPeriodStart,
    onPeriod,
    nextPeriodStart,
    nextPeriodEarliest: addDays(nextPeriodStart, -windowDays),
    nextPeriodLatest: addDays(nextPeriodStart, windowDays),
    daysUntilNextPeriod,
    daysLate,
    stale,
    ovulationDay,
    ovulationDate,
    fertileStart,
    fertileEnd,
    upcomingFertile,
    phase,
    chance,
    segments: buildSegments(cycleLength, periodLength, ovulationDay),
  };
}

// `label` is the proper term shown in the app; `meaning` is the one-line explanation shown underneath it.
export const PHASE_INFO: Record<
  Phase,
  { label: string; meaning: string; emoji: string; feel: string; tip: string }
> = {
  period: {
    label: "Period",
    meaning: "The days you are bleeding. Day 1 of your cycle is the first day of your period.",
    emoji: "🩸",
    feel: "Energy is often lower. Cramps and tiredness are common in the first days.",
    tip: "Keep warm, drink water, and rest when you can. Iron-rich foods like beans and leafy greens help.",
  },
  follicular: {
    label: "Follicular phase",
    meaning: "The days after your period, when your body is preparing an egg. Energy usually rises.",
    emoji: "🌱",
    feel: "Energy and mood usually lift as your body gets ready to release an egg.",
    tip: "A good time for new plans, workouts, and anything that needs focus.",
  },
  fertile: {
    label: "Fertile window",
    meaning: "The days you are most likely to get pregnant if you have sex. Ovulation (an egg being released) happens near the end.",
    emoji: "🌼",
    feel: "You may feel more energetic and notice clear, stretchy discharge.",
    tip: "Pregnancy is most likely on these days. Use protection if you are not trying to conceive.",
  },
  ovulation: {
    label: "Ovulation day",
    meaning: "Ovulation means an egg is released. It is the day you are most likely to get pregnant.",
    emoji: "✨",
    feel: "This is the estimated day an egg is released. Some people feel a small twinge on one side.",
    tip: "This is the peak day for pregnancy. Use protection if you are not trying to conceive.",
  },
  luteal: {
    label: "Luteal phase",
    meaning: "The days after ovulation, when your body slowly gets ready for the next period. PMS can show up at the end.",
    emoji: "🌙",
    feel: "Things settle and slow down. You may feel calmer, or a bit more tired.",
    tip: "Steady meals and good sleep help keep your mood even.",
  },
  pms: {
    label: "PMS days",
    meaning: "PMS means premenstrual syndrome: the cramps, cravings and mood swings in the last few days before a period.",
    emoji: "🍫",
    feel: "Bloating, cravings, and mood swings are common just before a period.",
    tip: "Be gentle with yourself. Less salt and caffeine, more sleep and light movement.",
  },
};

export const CHANCE_LABEL: Record<Chance, string> = {
  low: "Low chance of pregnancy",
  medium: "Medium chance of pregnancy",
  high: "High chance of pregnancy",
  peak: "Highest chance of pregnancy",
};

export type DayMark = "period" | "predicted" | "fertile" | "ovulation";

/** Marks for the calendar: logged periods plus predicted periods and fertile days. */
export function buildCalendarMarks(cycles: CycleLike[], prediction: Prediction | null) {
  const marks = new Map<DateKey, DayMark>();
  if (!prediction) return marks;

  if (!prediction.stale) {
    for (let cycle = 0; cycle < 4; cycle += 1) {
      const start = addDays(prediction.lastPeriodStart, cycle * prediction.cycleLength);
      // A late period means later cycles can't be placed until the next one is logged.
      if (cycle > 0 && prediction.daysLate > 0) break;
      if (cycle > 0) {
        for (let day = 0; day < prediction.periodLength; day += 1) {
          marks.set(addDays(start, day), "predicted");
        }
      }
      const ovulation = addDays(start, prediction.ovulationDay - 1);
      for (let day = -5; day <= 1; day += 1) marks.set(addDays(ovulation, day), "fertile");
      marks.set(ovulation, "ovulation");
    }
  }

  cycles.forEach((cycle) => {
    const start = toKey(cycle.startDate);
    const openEnd = addDays(start, prediction.periodLength - 1);
    const end = cycle.endDate ? toKey(cycle.endDate) : openEnd < prediction.today ? openEnd : prediction.today;
    for (let day = start; day <= end; day = addDays(day, 1)) marks.set(day, "period");
  });

  return marks;
}

export type PhaseBucket = "period" | "follicular" | "fertile" | "luteal";
export type PhaseAverages = Record<PhaseBucket, { count: number; cramps: number | null; energy: number | null; sleep: number | null }>;

/** Average cramps, energy and sleep in each part of the cycle, from the user's own logs. */
export function symptomsByPhase(cycles: CycleLike[], symptoms: SymptomLike[], prediction: Prediction | null) {
  const buckets: Record<PhaseBucket, { cramps: number[]; energy: number[]; sleep: number[]; count: number }> = {
    period: { cramps: [], energy: [], sleep: [], count: 0 },
    follicular: { cramps: [], energy: [], sleep: [], count: 0 },
    fertile: { cramps: [], energy: [], sleep: [], count: 0 },
    luteal: { cramps: [], energy: [], sleep: [], count: 0 },
  };
  if (prediction) {
    const starts = cycles.map((cycle) => toKey(cycle.startDate)).sort();
    symptoms.forEach((symptom) => {
      const date = toKey(symptom.date);
      const start = [...starts].reverse().find((key) => key <= date);
      if (!start) return;
      const day = diffDays(start, date) + 1;
      if (day > prediction.cycleLength + 10) return;
      const segment =
        prediction.segments.find((item) => day >= item.startDay && day <= item.endDay) ??
        prediction.segments[prediction.segments.length - 1];
      const bucket = buckets[segment.phase];
      bucket.count += 1;
      if (symptom.cramps) bucket.cramps.push(symptom.cramps);
      if (symptom.energy) bucket.energy.push(symptom.energy);
      if (symptom.sleep) bucket.sleep.push(symptom.sleep);
    });
  }
  const average = (values: number[]) =>
    values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : null;
  return Object.fromEntries(
    Object.entries(buckets).map(([phase, bucket]) => [
      phase,
      { count: bucket.count, cramps: average(bucket.cramps), energy: average(bucket.energy), sleep: average(bucket.sleep) },
    ])
  ) as PhaseAverages;
}

export function topMoods(symptoms: SymptomLike[], limit = 5) {
  const counts: Record<string, number> = {};
  symptoms.forEach((symptom) => {
    if (symptom.mood) counts[symptom.mood] = (counts[symptom.mood] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([mood, count]) => ({ mood, count }));
}
