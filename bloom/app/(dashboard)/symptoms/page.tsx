"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Sticker from "@/components/ui/Sticker";
import StickerBadge from "@/components/ui/StickerBadge";
import { useToast } from "@/components/ui/Toast";
import api from "@/lib/api";
import { formatKey, toKey } from "@/lib/dates";
import { BLOOM_STICKERS, findSticker } from "@/lib/stickers";
import { authHeader, useBloomData } from "@/lib/useBloomData";

type Entry = { mood?: string; cramps?: number; sleep?: number; energy?: number; notes: string };

const SCALES = [
  { key: "cramps", label: "Cramps", emoji: "😣", low: "None", high: "Very bad" },
  { key: "energy", label: "Energy", emoji: "⚡", low: "Drained", high: "Full of energy" },
  { key: "sleep", label: "Sleep", emoji: "😴", low: "Poor", high: "Great" },
] as const;

export default function SymptomsPage() {
  const { token, today, symptoms, loading } = useBloomData();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();
  const [date, setDate] = useState<string | null>(null);
  const [entry, setEntry] = useState<Entry>({ notes: "" });

  useEffect(() => {
    if (today && !date) setDate(today);
  }, [today, date]);

  // Show what is already saved for the chosen day so it can be edited.
  const saved = symptoms.find((symptom) => toKey(symptom.date) === date);
  const savedId = saved?.id;
  useEffect(() => {
    setEntry({
      mood: saved?.mood ?? undefined,
      cramps: saved?.cramps ?? undefined,
      sleep: saved?.sleep ?? undefined,
      energy: saved?.energy ?? undefined,
      notes: saved?.notes ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, date]);

  const save = useMutation({
    mutationFn: async () => {
      // null clears a value that was saved earlier for this day.
      await api.post(
        "/symptoms",
        {
          date,
          mood: entry.mood ?? null,
          cramps: entry.cramps ?? null,
          sleep: entry.sleep ?? null,
          energy: entry.energy ?? null,
          notes: entry.notes.trim() || null,
        },
        authHeader(token)
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["symptoms"] });
      showToast("Saved 💗");
    },
    onError: () => showToast("Couldn't save. Check your connection and try again."),
  });

  if (loading || !date || !today) {
    return <div className="h-96 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  }

  const hasSomething = entry.mood || entry.cramps || entry.sleep || entry.energy || entry.notes.trim();

  return (
    <>
      {toast}

      <Card title="How are you today?" subtitle="Fill in as much or as little as you like">
        <div className="space-y-6">
          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Day</span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(event) => event.target.value && setDate(event.target.value)}
              className="field"
            />
          </label>

          <div>
            <p className="mb-2 text-sm font-bold text-ink">Mood</p>
            <div className="-mx-1 grid grid-cols-4 justify-items-center gap-y-1 sm:grid-cols-5">
              {BLOOM_STICKERS.map((sticker) => (
                <StickerBadge
                  key={sticker.id}
                  sticker={sticker}
                  selected={entry.mood === sticker.label}
                  onClick={() =>
                    setEntry((current) => ({
                      ...current,
                      mood: current.mood === sticker.label ? undefined : sticker.label,
                    }))
                  }
                />
              ))}
            </div>
          </div>

          {SCALES.map((scale) => {
            const value = entry[scale.key];
            return (
              <div key={scale.key}>
                <p className="mb-2 text-sm font-bold text-ink">
                  <span aria-hidden="true">{scale.emoji} </span>
                  {scale.label}
                </p>
                <div className="flex gap-2" role="group" aria-label={`${scale.label}, 1 to 5`}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <button
                      key={level}
                      type="button"
                      aria-pressed={value === level}
                      onClick={() =>
                        setEntry((current) => ({ ...current, [scale.key]: current[scale.key] === level ? undefined : level }))
                      }
                      className={`h-12 flex-1 cursor-pointer rounded-2xl border-[1.5px] text-base font-extrabold transition active:scale-95 ${
                        value === level
                          ? "border-primary bg-primary text-on-primary"
                          : value && level < value
                          ? "border-primary-soft bg-primary-soft text-primary-ink"
                          : "border-line bg-surface text-muted"
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{scale.low}</span>
                  <span>{scale.high}</span>
                </div>
              </div>
            );
          })}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-ink">Note (optional)</span>
            <textarea
              value={entry.notes}
              maxLength={1000}
              onChange={(event) => setEntry((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Anything you want to remember about today"
              className="field min-h-24"
            />
          </label>

          <button type="button" disabled={!hasSomething || save.isPending} onClick={() => save.mutate()} className="btn btn-primary w-full">
            {save.isPending ? "Saving..." : saved ? "Update" : "Save"}
          </button>
        </div>
      </Card>

      <Card title="Recent days">
        {symptoms.length ? (
          <ul className="divide-y divide-line">
            {symptoms.slice(0, 7).map((symptom) => {
              const sticker = findSticker(symptom.mood);
              const day = toKey(symptom.date);
              return (
                <li key={symptom.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setDate(day);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 py-3 text-left"
                  >
                    <span
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                      style={{ background: sticker?.tint ?? "var(--bg)" }}
                      aria-hidden="true"
                    >
                      {sticker?.emoji ?? "📝"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-ink">
                        {formatKey(day, { weekday: "short", month: "short", day: "numeric" })}
                        {symptom.mood ? ` · ${symptom.mood}` : ""}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        {[
                          symptom.cramps ? `Cramps ${symptom.cramps}/5` : null,
                          symptom.energy ? `Energy ${symptom.energy}/5` : null,
                          symptom.sleep ? `Sleep ${symptom.sleep}/5` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ") || symptom.notes || "Mood check-in"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-4">
            <Sticker emoji="📝" size={52} />
            <p className="text-sm text-muted">Nothing here yet. The days you save will show up here.</p>
          </div>
        )}
      </Card>
    </>
  );
}
