import { PHASE_INFO, Prediction } from "@/lib/predictor";

const SIZE = 240;
const CENTER = SIZE / 2;
const RADIUS = 98;
const STROKE = 20;
const GAP_DEGREES = 2.4;

export const PHASE_COLORS = {
  period: "var(--phase-period)",
  follicular: "var(--phase-follicular)",
  fertile: "var(--phase-fertile)",
  luteal: "var(--phase-luteal)",
} as const;

export const PHASE_NAMES = {
  period: "Period",
  follicular: "Follicular",
  fertile: "Fertile",
  luteal: "Luteal",
} as const;

function point(angle: number, radius = RADIUS) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
}

function arc(startAngle: number, endAngle: number) {
  const start = point(startAngle);
  const end = point(endAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

/** The whole cycle as a ring: one arc per phase, a marker for today, and the day count in the middle. */
export default function CycleRing({ prediction }: { prediction: Prediction }) {
  const { cycleLength, cycleDay, segments, ovulationDay } = prediction;
  const perDay = 360 / cycleLength;
  const shownDay = Math.min(cycleDay, cycleLength);
  const today = point((shownDay - 0.5) * perDay);
  const ovulation = point((ovulationDay - 0.5) * perDay);
  const phase = PHASE_INFO[prediction.phase];

  return (
    <figure className="flex flex-col items-center gap-4">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-[15rem]"
        role="img"
        aria-label={`Day ${cycleDay} of a ${cycleLength}-day cycle. ${phase.label}.`}
      >
        {segments.map((segment) => (
          <path
            key={segment.phase}
            d={arc((segment.startDay - 1) * perDay + GAP_DEGREES / 2, segment.endDay * perDay - GAP_DEGREES / 2)}
            stroke={PHASE_COLORS[segment.phase]}
            strokeWidth={STROKE}
            fill="none"
          >
            <title>{`${PHASE_NAMES[segment.phase]}: day ${segment.startDay} to ${segment.endDay}`}</title>
          </path>
        ))}

        <circle cx={ovulation.x} cy={ovulation.y} r="4" fill="var(--surface)">
          <title>{`Ovulation: around day ${ovulationDay}`}</title>
        </circle>

        <circle cx={today.x} cy={today.y} r="13" fill="var(--surface)" stroke="var(--ink)" strokeWidth="3" />
        <circle cx={today.x} cy={today.y} r="4.5" fill="var(--ink)" />

        <text x={CENTER} y={CENTER - 26} textAnchor="middle" className="fill-muted text-[13px] font-bold">
          {prediction.daysLate > 0 ? "Cycle day" : "Day"}
        </text>
        <text x={CENTER} y={CENTER + 22} textAnchor="middle" className="fill-ink font-display text-[56px] font-semibold">
          {cycleDay}
        </text>
        <text x={CENTER} y={CENTER + 46} textAnchor="middle" className="fill-muted text-[13px] font-bold">
          of {cycleLength}
        </text>
      </svg>

      <figcaption className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs font-bold text-muted">
        {segments.map((segment) => (
          <span key={segment.phase} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: PHASE_COLORS[segment.phase] }} />
            {PHASE_NAMES[segment.phase]}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-[2.5px] border-ink bg-surface" />
          Today
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full" style={{ background: PHASE_COLORS.fertile }}>
            <span className="h-1.5 w-1.5 rounded-full bg-surface" />
          </span>
          Ovulation
        </span>
      </figcaption>
    </figure>
  );
}
