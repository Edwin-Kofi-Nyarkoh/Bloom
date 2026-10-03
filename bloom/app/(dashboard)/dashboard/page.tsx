"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Sticker from "@/components/ui/Sticker";
import StickerBadge from "@/components/ui/StickerBadge";
import BloomFlower from "@/components/ui/BloomFlower";
import { useToast } from "@/components/ui/Toast";
import CycleRing, { PHASE_COLORS } from "@/components/charts/CycleRing";
import PwaInstallBanner from "@/components/pwa/PwaInstallBanner";
import api, { apiErrorMessage } from "@/lib/api";
import { formatKey, formatRange, toKey } from "@/lib/dates";
import { CHANCE_LABEL, PHASE_INFO, Prediction } from "@/lib/predictor";
import { BLOOM_STICKERS, StickerItem } from "@/lib/stickers";
import { authHeader, useBloomData } from "@/lib/useBloomData";

const CHANCE_STYLE = {
  low: "bg-mint-soft text-ink",
  medium: "bg-sun-soft text-ink",
  high: "bg-primary-soft text-ink",
  peak: "bg-primary-soft text-ink",
} as const;

function headline(prediction: Prediction) {
  if (prediction.stale) return "Time for a fresh start";
  if (prediction.onPeriod) return `Day ${prediction.cycleDay} of your period`;
  if (prediction.daysLate > 0) {
    return `Period is ${prediction.daysLate} ${prediction.daysLate === 1 ? "day" : "days"} late`;
  }
  if (prediction.daysUntilNextPeriod === 0) return "Period expected today";
  return `Period in ${prediction.daysUntilNextPeriod} ${prediction.daysUntilNextPeriod === 1 ? "day" : "days"}`;
}

export default function DashboardPage() {
  const { token, today, cycles, symptoms, prediction, loading } = useBloomData();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();
  const [firstPeriod, setFirstPeriod] = useState("");
  const [logOpen, setLogOpen] = useState(false);
  const [logDate, setLogDate] = useState("");

  const openCycle = cycles.find((cycle) => !cycle.endDate && toKey(cycle.startDate) === prediction?.lastPeriodStart);
  const todayMood = symptoms.find((symptom) => toKey(symptom.date) === today)?.mood;

  const startPeriod = useMutation({
    mutationFn: async (startDate: string) => {
      await api.post("/cycles", { startDate }, authHeader(token));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      setLogOpen(false);
      showToast("Period saved 🌸");
    },
    onError: (error) => showToast(apiErrorMessage(error, "Couldn't save that. Please try again.")),
  });

  const endPeriod = useMutation({
    mutationFn: async () => {
      if (!openCycle) return;
      await api.put(
        `/cycles/${openCycle.id}`,
        { startDate: toKey(openCycle.startDate), endDate: today },
        authHeader(token)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      showToast("Period end saved 💗");
    },
    onError: (error) => showToast(apiErrorMessage(error, "Couldn't save that. Please try again.")),
  });

  const logMood = useMutation({
    mutationFn: async (sticker: StickerItem) => {
      await api.post("/symptoms", { date: today, mood: sticker.label }, authHeader(token));
    },
    onSuccess: (_, sticker) => {
      queryClient.invalidateQueries({ queryKey: ["symptoms"] });
      showToast(`Feeling ${sticker.label.toLowerCase()} ${sticker.emoji} saved`);
    },
    onError: () => showToast("Couldn't save your mood. Check your connection."),
  });

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <div className="h-96 animate-pulse rounded-3xl bg-surface" />
        <div className="h-36 animate-pulse rounded-3xl bg-surface" />
      </div>
    );
  }

  const moodCard = (
    <Card title="How do you feel today?" subtitle="Tap a sticker to save it">
      <div className="-mx-2 flex gap-1 overflow-x-auto px-2 pb-1">
        {BLOOM_STICKERS.map((sticker) => (
          <StickerBadge
            key={sticker.id}
            sticker={sticker}
            selected={todayMood === sticker.label}
            disabled={logMood.isPending}
            onClick={() => logMood.mutate(sticker)}
          />
        ))}
      </div>
    </Card>
  );

  // A brand-new account: nothing is assumed until she logs her first period.
  if (!prediction) {
    return (
      <>
        {toast}
        <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 text-center shadow-soft">
          <Sticker emoji="🌷" size={52} tilt={-12} float className="absolute left-4 top-4" />
          <Sticker emoji="💗" size={44} tilt={10} float className="absolute right-5 top-6" />
          <div className="mx-auto mt-6 w-fit">
            <BloomFlower size={88} />
          </div>
          <h1 className="mt-3 font-display text-3xl font-semibold text-ink">Welcome to Bloom</h1>
          <p className="mx-auto mt-2 max-w-xs text-muted">
            Tell me when your last period started and I&apos;ll predict your next one.
          </p>

          <form
            className="mx-auto mt-6 max-w-xs space-y-3 text-left"
            onSubmit={(event) => {
              event.preventDefault();
              if (firstPeriod) startPeriod.mutate(firstPeriod);
            }}
          >
            <label className="block text-sm font-bold text-ink" htmlFor="first-period">
              My last period started on
            </label>
            <input
              id="first-period"
              type="date"
              required
              max={today ?? undefined}
              value={firstPeriod}
              onChange={(event) => setFirstPeriod(event.target.value)}
              className="field"
            />
            <button type="submit" disabled={!firstPeriod || startPeriod.isPending} className="btn btn-primary w-full">
              {startPeriod.isPending ? "Saving..." : "Start tracking"}
            </button>
          </form>
          <p className="mt-4 text-xs text-muted">Not sure? Your best guess is fine. You can change it later.</p>
        </section>
        {moodCard}
      </>
    );
  }

  const phase = PHASE_INFO[prediction.phase];
  const fertile = prediction.upcomingFertile;
  // On the ring, ovulation day is part of the fertile window and PMS days are part of the luteal phase.
  const ringPhase = prediction.phase === "ovulation" ? "fertile" : prediction.phase === "pms" ? "luteal" : prediction.phase;
  const guide = [
    { phase: "period", info: PHASE_INFO.period },
    { phase: "follicular", info: PHASE_INFO.follicular },
    { phase: "fertile", info: PHASE_INFO.fertile },
    { phase: "luteal", info: PHASE_INFO.luteal },
  ] as const;

  return (
    <>
      {toast}

      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <Sticker emoji={phase.emoji} size={46} tilt={-10} float className="absolute left-4 top-4" />
        <Sticker emoji="🌸" size={38} tilt={12} float className="absolute right-4 top-5" />

        <div className="pt-2">
          <CycleRing prediction={prediction} />
        </div>

        <div className="mt-5 text-center">
          <h1 className="font-display text-2xl font-semibold text-ink">{headline(prediction)}</h1>
          <p className="mt-1 text-sm text-muted">
            {prediction.stale
              ? `The last period you added was ${formatKey(prediction.lastPeriodStart)}. Add your latest one to refresh your predictions.`
              : prediction.daysLate > 0
              ? `It was expected around ${formatKey(prediction.nextPeriodStart)}. A few days' delay is common.`
              : `Next period around ${formatKey(prediction.nextPeriodStart)} (${formatRange(
                  prediction.nextPeriodEarliest,
                  prediction.nextPeriodLatest
                )})`}
          </p>
          {!prediction.stale ? (
            <span className={`mt-3 inline-flex rounded-full px-3.5 py-1.5 text-sm font-extrabold ${CHANCE_STYLE[prediction.chance]}`}>
              {phase.label} · {CHANCE_LABEL[prediction.chance]}
            </span>
          ) : null}
        </div>

        <div className="mt-5 space-y-2.5">
          {logOpen ? (
            <form
              className="space-y-2.5 rounded-2xl bg-bg p-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                if (logDate) startPeriod.mutate(logDate);
              }}
            >
              <label className="block text-sm font-bold text-ink" htmlFor="log-period-date">
                When did your period start?
              </label>
              <input
                id="log-period-date"
                type="date"
                required
                max={today ?? undefined}
                value={logDate}
                onChange={(event) => setLogDate(event.target.value)}
                className="field"
              />
              <div className="grid grid-cols-2 gap-2.5">
                <button type="button" onClick={() => setLogOpen(false)} className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" disabled={!logDate || startPeriod.isPending} className="btn btn-primary">
                  {startPeriod.isPending ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setLogDate(today ?? "");
                setLogOpen(true);
              }}
              className="btn btn-primary w-full"
            >
              🩸 Add my period
            </button>
          )}
          {openCycle && prediction.onPeriod ? (
            <button type="button" onClick={() => endPeriod.mutate()} disabled={endPeriod.isPending} className="btn btn-soft w-full">
              {endPeriod.isPending ? "Saving..." : "My period ended today"}
            </button>
          ) : null}
        </div>
      </section>

      {!prediction.stale ? (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Next period", value: prediction.daysLate > 0 ? "Late" : formatKey(prediction.nextPeriodStart), tint: "bg-primary-soft" },
            { label: "Fertile days", value: fertile ? formatRange(fertile.start, fertile.end) : "—", tint: "bg-mint-soft" },
            { label: "Ovulation", value: fertile ? formatKey(fertile.ovulation) : "—", tint: "bg-sun-soft" },
          ].map((tile) => (
            <div key={tile.label} className={`rounded-2xl p-3 text-center ${tile.tint}`}>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{tile.label}</p>
              <p className="mt-1 text-sm font-extrabold leading-tight text-ink">{tile.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {moodCard}

      {!prediction.stale ? (
        <Card title={`Today: ${phase.label.toLowerCase()}`}>
          <p className="text-[15px] text-ink">
            {phase.meaning} {phase.feel}
          </p>
          <p className="mt-3 rounded-2xl bg-bg p-3.5 text-sm text-ink">
            <span className="font-extrabold text-primary-ink">Tip: </span>
            {phase.tip}
          </p>
          <Link href="/chat" className="btn btn-ghost mt-4 w-full">
            💬 Ask Bloom AI anything
          </Link>
        </Card>
      ) : null}

      <Card title="What these words mean" subtitle="The four parts of your cycle">
        <ul className="space-y-3">
          {guide.map(({ phase: key, info }) => (
            <li key={key} className={`flex gap-3 rounded-2xl p-3 ${key === ringPhase && !prediction.stale ? "bg-bg" : ""}`}>
              <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ background: PHASE_COLORS[key] }} />
              <div>
                <p className="font-extrabold text-ink">
                  {info.emoji} {info.label}
                  {key === ringPhase && !prediction.stale ? (
                    <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-ink">You are here</span>
                  ) : null}
                </p>
                <p className="text-sm text-muted">{info.meaning}</p>
              </div>
            </li>
          ))}
          <li className="flex gap-3 rounded-2xl p-3">
            <span className="mt-1 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full" style={{ background: PHASE_COLORS.fertile }}>
              <span className="h-1.5 w-1.5 rounded-full bg-surface" />
            </span>
            <div>
              <p className="font-extrabold text-ink">{PHASE_INFO.ovulation.emoji} Ovulation</p>
              <p className="text-sm text-muted">{PHASE_INFO.ovulation.meaning} It is the white dot on the ring.</p>
            </div>
          </li>
        </ul>
      </Card>

      <PwaInstallBanner />

      <p className="px-2 text-center text-xs text-muted">
        Predictions are estimates based on the dates you add. They are not medical advice or birth control.
        {prediction.confidence === "low" ? " They get more accurate after you add two or three periods." : ""}
      </p>
    </>
  );
}
