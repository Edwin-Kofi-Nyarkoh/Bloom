import { PhaseAverages, PhaseBucket } from "@/lib/predictor";
import { PHASE_COLORS, PHASE_NAMES } from "./CycleRing";

const MEASURES = [
  { key: "cramps", label: "Cramps", color: "var(--phase-period)" },
  { key: "energy", label: "Energy", color: "var(--phase-luteal)" },
  { key: "sleep", label: "Sleep", color: "var(--phase-follicular)" },
] as const;

const PHASES: PhaseBucket[] = ["period", "follicular", "fertile", "luteal"];

/** Average cramps, energy and sleep (1 to 5) in each part of the cycle. */
export default function PhaseFeelChart({ averages }: { averages: PhaseAverages }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-muted">
        {MEASURES.map((measure) => (
          <span key={measure.key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: measure.color }} />
            {measure.label}
          </span>
        ))}
        <span className="ml-auto font-semibold">out of 5</span>
      </div>

      <div className="space-y-4">
        {PHASES.map((phase) => {
          const data = averages[phase];
          return (
            <div key={phase} className="grid grid-cols-[6rem_1fr] items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-bold text-ink">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: PHASE_COLORS[phase] }} />
                {PHASE_NAMES[phase]}
              </div>
              {data.count === 0 ? (
                <p className="text-xs text-muted">No check-ins yet</p>
              ) : (
                <div className="space-y-1">
                  {MEASURES.map((measure) => {
                    const value = data[measure.key];
                    return (
                      <div
                        key={measure.key}
                        className="flex items-center gap-2"
                        title={value === null ? `${measure.label}: nothing saved` : `${measure.label}: ${value} out of 5`}
                      >
                        <div className="h-2 flex-1 rounded-full bg-bg">
                          {value !== null ? (
                            <div
                              className="h-2 rounded-full"
                              style={{ width: `${(value / 5) * 100}%`, background: measure.color }}
                            />
                          ) : null}
                        </div>
                        <span className="w-7 text-right text-xs font-bold text-ink">{value ?? "–"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
