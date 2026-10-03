"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import Sticker from "@/components/ui/Sticker";
import CycleLengthChart from "@/components/charts/CycleLengthChart";
import PhaseFeelChart from "@/components/charts/PhaseFeelChart";
import { diffDays, formatKey, toKey } from "@/lib/dates";
import { symptomsByPhase, topMoods } from "@/lib/predictor";
import { findSticker } from "@/lib/stickers";
import { useBloomData } from "@/lib/useBloomData";

const CONFIDENCE_TEXT = {
  low: "Early estimate",
  medium: "Getting accurate",
  high: "Very reliable",
} as const;

export default function InsightsPage() {
  const { cycles, symptoms, prediction, loading } = useBloomData();

  if (loading) {
    return <div className="h-96 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  }

  if (!prediction) {
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Sticker emoji="📊" size={64} float />
          <h1 className="font-display text-2xl font-semibold text-ink">Your insights will grow here</h1>
          <p className="max-w-xs text-muted">Add your first period and Bloom will start drawing your charts.</p>
          <Link href="/calendar" className="btn btn-primary mt-2">
            Open the calendar
          </Link>
        </div>
      </Card>
    );
  }

  // Pair each cycle length with the date that cycle started.
  const starts = cycles.map((cycle) => toKey(cycle.startDate)).sort();
  const bars = starts
    .slice(1)
    .map((start, index) => ({ label: formatKey(starts[index]), length: diffDays(starts[index], start) }))
    .filter((bar) => bar.length >= 15 && bar.length <= 60);

  const moods = topMoods(symptoms, 5);
  const averages = symptomsByPhase(cycles, symptoms, prediction);
  const hasFeelings = Object.values(averages).some((phase) => phase.count > 0);

  const tiles = [
    { label: "Cycle length", value: `${prediction.cycleLength}`, unit: "days", tint: "bg-primary-soft" },
    { label: "Period length", value: `${prediction.periodLength}`, unit: "days", tint: "bg-lilac-soft" },
    { label: "Periods added", value: `${cycles.length}`, unit: CONFIDENCE_TEXT[prediction.confidence], tint: "bg-mint-soft" },
  ];

  return (
    <>
      <div className="grid grid-cols-3 gap-3">
        {tiles.map((tile) => (
          <div key={tile.label} className={`rounded-2xl p-3 text-center ${tile.tint}`}>
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tile.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold leading-none text-ink">{tile.value}</p>
            <p className="mt-1 text-xs font-bold text-muted">{tile.unit}</p>
          </div>
        ))}
      </div>

      <Card title="Cycle length" subtitle="Days from one period to the next">
        {bars.length >= 2 ? (
          <>
            <CycleLengthChart bars={bars} average={prediction.cycleLength} />
            <p className="mt-3 text-sm text-muted">
              {prediction.variation <= 2.5
                ? "Your cycles are very regular. 🌟"
                : prediction.variation <= 5
                ? "Your cycles vary by a few days, which is normal."
                : "Your cycles vary quite a bit. That's common, but mention it to a doctor if it worries you."}
            </p>
          </>
        ) : (
          <div className="flex items-center gap-4">
            <Sticker emoji="🌱" size={52} />
            <p className="text-sm text-muted">This chart appears once you have added three periods.</p>
          </div>
        )}
      </Card>

      <Card title="How you feel through your cycle" subtitle="Averages from your check-ins">
        {hasFeelings ? (
          <PhaseFeelChart averages={averages} />
        ) : (
          <div className="flex items-center gap-4">
            <Sticker emoji="💭" size={52} />
            <p className="text-sm text-muted">
              Save your cramps, energy, and sleep on the <Link href="/symptoms" className="font-bold text-primary-ink">My day</Link> tab to see patterns here.
            </p>
          </div>
        )}
      </Card>

      <Card title="Your moods" subtitle="The feelings you pick most">
        {moods.length ? (
          <ul className="flex flex-wrap gap-3">
            {moods.map(({ mood, count }) => {
              const sticker = findSticker(mood);
              return (
                <li key={mood} className="flex items-center gap-2 rounded-full border border-line py-1.5 pl-1.5 pr-4">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                    style={{ background: sticker?.tint ?? "var(--bg)" }}
                    aria-hidden="true"
                  >
                    {sticker?.emoji ?? "💗"}
                  </span>
                  <span className="text-sm font-bold text-ink">{mood}</span>
                  <span className="text-sm text-muted">×{count}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-4">
            <Sticker emoji="😊" size={52} />
            <p className="text-sm text-muted">Tap a mood sticker on the Home screen to start.</p>
          </div>
        )}
      </Card>
    </>
  );
}
