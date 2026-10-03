const WIDTH = 320;
const HEIGHT = 170;
const TOP = 26;
const BOTTOM = 26;
const PLOT = HEIGHT - TOP - BOTTOM;

export type CycleBar = { label: string; length: number };

/** Line chart of recent cycle lengths with the average drawn as a dashed line. */
export default function CycleLengthChart({ bars, average }: { bars: CycleBar[]; average: number }) {
  const shown = bars.slice(-8);
  // The axis is zoomed to the range of the data so small day-to-day changes are visible.
  const floor = Math.max(0, Math.min(...shown.map((bar) => bar.length), average) - 4);
  const ceiling = Math.max(...shown.map((bar) => bar.length), average) + 3;
  const scale = (value: number) => TOP + PLOT - ((value - floor) / (ceiling - floor)) * PLOT;

  const slot = WIDTH / shown.length;
  const xOf = (index: number) => index * slot + slot / 2;
  const averageY = scale(average);

  return (
    <figure>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        role="img"
        aria-label={`Cycle lengths in days: ${shown.map((bar) => bar.length).join(", ")}. Average ${average} days.`}
      >
        <line x1="0" x2={WIDTH} y1={TOP + PLOT} y2={TOP + PLOT} stroke="var(--line)" strokeWidth="1.5" />
        <line
          x1="0"
          x2={WIDTH}
          y1={averageY}
          y2={averageY}
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          opacity="0.55"
        />
        <polyline
          points={shown.map((bar, index) => `${xOf(index)},${scale(bar.length)}`).join(" ")}
          fill="none"
          stroke="var(--phase-period)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {shown.map((bar, index) => {
          const x = xOf(index);
          const y = scale(bar.length);
          return (
            <g key={`${bar.label}-${index}`}>
              <circle cx={x} cy={y} r="6" fill="var(--phase-period)" stroke="var(--surface)" strokeWidth="2.5">
                <title>{`Cycle starting ${bar.label}: ${bar.length} days`}</title>
              </circle>
              <text x={x} y={y - 12} textAnchor="middle" className="fill-ink text-[12px] font-bold">
                {bar.length}
              </text>
              <text x={x} y={HEIGHT - 8} textAnchor="middle" className="fill-muted text-[10px] font-semibold">
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex items-center justify-center gap-2 text-xs font-bold text-muted">
        <span className="inline-block w-6 border-t-2 border-dashed border-ink opacity-60" />
        Your average: {average} days
      </figcaption>
    </figure>
  );
}
