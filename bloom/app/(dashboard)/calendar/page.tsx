"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Sticker from "@/components/ui/Sticker";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { useToast } from "@/components/ui/Toast";
import api, { apiErrorMessage } from "@/lib/api";
import { addDays, diffDays, formatKey, formatRange, keyToMs, toKey } from "@/lib/dates";
import { DayMark, buildCalendarMarks } from "@/lib/predictor";
import { Cycle, authHeader, useBloomData } from "@/lib/useBloomData";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const MARK_STYLE: Record<DayMark, string> = {
  period: "bg-primary text-on-primary",
  predicted: "border-2 border-dashed border-primary text-primary-ink",
  fertile: "bg-mint-soft text-ink",
  ovulation: "bg-mint-soft text-ink ring-2 ring-mint",
};

const MARK_LABEL: Record<DayMark, string> = {
  period: "Period day",
  predicted: "Period expected",
  fertile: "Fertile day (higher chance of pregnancy)",
  ovulation: "Estimated ovulation day",
};

function monthDays(month: string) {
  const first = `${month}-01`;
  const start = new Date(keyToMs(first));
  const daysInMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  const blanks = start.getUTCDay();
  return { first, daysInMonth, blanks };
}

function shiftMonth(month: string, by: number) {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1 + by, 1)).toISOString().slice(0, 7);
}

function errorMessage(error: unknown) {
  return apiErrorMessage(error, "Couldn't save that. Please try again.");
}

export default function CalendarPage() {
  const { token, today, cycles, prediction, loading } = useBloomData();
  const queryClient = useQueryClient();
  const { toast, showToast } = useToast();
  // Until she picks something, the calendar shows this month with today selected.
  const [pickedMonth, setMonth] = useState<string | null>(null);
  const [pickedDay, setSelected] = useState<string | null>(null);
  const month = pickedMonth ?? today?.slice(0, 7) ?? null;
  const selected = pickedDay ?? today;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["cycles"] });

  const startPeriod = useMutation({
    mutationFn: async (startDate: string) => {
      await api.post("/cycles", { startDate }, authHeader(token));
    },
    onSuccess: () => {
      refresh();
      showToast("Period start saved 🌸");
    },
    onError: (error) => showToast(errorMessage(error)),
  });

  const endPeriod = useMutation({
    mutationFn: async ({ cycle, endDate }: { cycle: Cycle; endDate: string }) => {
      await api.put(`/cycles/${cycle.id}`, { startDate: toKey(cycle.startDate), endDate }, authHeader(token));
    },
    onSuccess: () => {
      refresh();
      showToast("Period end saved 💗");
    },
    onError: (error) => showToast(errorMessage(error)),
  });

  const deletePeriod = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/cycles/${id}`, authHeader(token));
    },
    onSuccess: () => {
      refresh();
      showToast("Period removed");
    },
    onError: (error) => showToast(errorMessage(error)),
  });

  if (loading || !month || !selected || !today) {
    return <div className="h-96 animate-pulse rounded-3xl bg-surface" aria-busy="true" />;
  }

  const marks = buildCalendarMarks(cycles, prediction);
  const { first, daysInMonth, blanks } = monthDays(month);
  const periodLength = prediction?.periodLength ?? 5;

  // The logged period the selected day belongs to, and the one it could close.
  const containing = cycles.find((cycle) => {
    const start = toKey(cycle.startDate);
    const end = cycle.endDate ? toKey(cycle.endDate) : addDays(start, periodLength - 1);
    return selected >= start && selected <= end;
  });
  const closable = cycles.find((cycle) => {
    const start = toKey(cycle.startDate);
    return !cycle.endDate && selected > start && diffDays(start, selected) <= 14;
  });
  const selectedMark = marks.get(selected);
  const isFuture = selected > today;
  const busy = startPeriod.isPending || endPeriod.isPending || deletePeriod.isPending;

  return (
    <>
      {toast}

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(shiftMonth(month, -1))}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-line text-ink"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="font-display text-xl font-semibold text-ink">
            {formatKey(first, { month: "long", year: "numeric" })}
          </h1>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(shiftMonth(month, 1))}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-line text-ink"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1.5 text-center">
          {WEEKDAYS.map((day, index) => (
            <span key={index} className="pb-1 text-xs font-bold text-muted">
              {day}
            </span>
          ))}
          {Array.from({ length: blanks }).map((_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const key = addDays(first, index);
            const mark = marks.get(key);
            const isSelected = key === selected;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-pressed={isSelected}
                aria-label={`${formatKey(key, { month: "long", day: "numeric" })}${mark ? `, ${MARK_LABEL[mark]}` : ""}`}
                className="flex cursor-pointer flex-col items-center gap-0.5 py-0.5"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                    mark ? MARK_STYLE[mark] : "text-ink"
                  } ${isSelected ? "outline-[2.5px] outline-offset-2 outline-ink" : ""}`}
                >
                  {index + 1}
                </span>
                <span className={`h-1 w-1 rounded-full ${key === today ? "bg-ink" : ""}`} />
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-1.5 border-t border-line pt-4 text-xs font-bold text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-primary" /> Period
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full border-2 border-dashed border-primary" /> Expected
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-mint-soft ring-1 ring-mint" /> Fertile
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-ink" /> Today
          </span>
        </div>
      </Card>

      <Card
        title={formatKey(selected, { weekday: "long", month: "long", day: "numeric" })}
        subtitle={selectedMark ? MARK_LABEL[selectedMark] : isFuture ? "Nothing predicted for this day" : "Nothing saved for this day"}
      >
        {isFuture ? (
          <p className="text-sm text-muted">You can add a period once the day arrives.</p>
        ) : (
          <div className="space-y-2.5">
            {!containing ? (
              <button type="button" disabled={busy} onClick={() => startPeriod.mutate(selected)} className="btn btn-primary w-full">
                Period started this day
              </button>
            ) : null}
            {closable ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => endPeriod.mutate({ cycle: closable, endDate: selected })}
                className="btn btn-soft w-full"
              >
                Period ended this day
              </button>
            ) : null}
            {containing ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Remove this period from your history?")) deletePeriod.mutate(containing.id);
                }}
                className="btn btn-ghost w-full text-danger"
              >
                Remove this period
              </button>
            ) : null}
          </div>
        )}
      </Card>

      <Card title="Your periods">
        {cycles.length ? (
          <ul className="divide-y divide-line">
            {cycles.map((cycle) => {
              const start = toKey(cycle.startDate);
              const end = cycle.endDate ? toKey(cycle.endDate) : null;
              return (
                <li key={cycle.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <button
                    type="button"
                    className="cursor-pointer text-left"
                    onClick={() => {
                      setMonth(start.slice(0, 7));
                      setSelected(start);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <p className="font-bold text-ink">{end ? formatRange(start, end) : `Started ${formatKey(start)}`}</p>
                    <p className="text-sm text-muted">
                      {end ? `${diffDays(start, end) + 1} days` : "End date not set yet"} · {start.slice(0, 4)}
                    </p>
                  </button>
                  <span className="h-3 w-3 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-4">
            <Sticker emoji="📅" size={52} />
            <p className="text-sm text-muted">
              No periods yet. Tap the day your last period started, then press <strong className="text-ink">Period started this day</strong>.
            </p>
          </div>
        )}
      </Card>
    </>
  );
}
