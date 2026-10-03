"use client";

import { useSession } from "next-auth/react";
import Card from "@/components/ui/Card";
import PwaInstallButton from "@/components/pwa/PwaInstallButton";
import SignOutButton from "@/components/ui/SignOutButton";
import { useThemeMode } from "@/lib/theme";
import { todayKey, toKey } from "@/lib/dates";
import { useBloomData } from "@/lib/useBloomData";

const THEMES = [
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
  { mode: "system", label: "Auto" },
] as const;

export default function SettingsPage() {
  const { data: session } = useSession();
  const { mode, setMode } = useThemeMode();
  const { cycles, symptoms } = useBloomData();

  const exportData = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      periods: cycles.map((cycle) => ({
        start: toKey(cycle.startDate),
        end: cycle.endDate ? toKey(cycle.endDate) : null,
      })),
      checkIns: symptoms.map(({ date, mood, cramps, sleep, energy, notes }) => ({
        date: toKey(date),
        mood,
        cramps,
        sleep,
        energy,
        notes,
      })),
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `bloom-data-${todayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card title="Account">
        <p className="text-[15px] text-ink">{session?.user?.email ?? "Guest mode"}</p>
        {!session?.user?.email ? (
          <p className="mt-1 text-sm text-muted">
            Guests are remembered by this browser only. If you clear it, you lose access to what you saved.
          </p>
        ) : null}
        <div className="mt-4">
          <SignOutButton />
        </div>
      </Card>

      <Card title="Appearance">
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Theme">
          {THEMES.map((theme) => (
            <button
              key={theme.mode}
              type="button"
              aria-pressed={mode === theme.mode}
              onClick={() => setMode(theme.mode)}
              className={`btn ${mode === theme.mode ? "btn-primary" : "btn-ghost"}`}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Install the app" subtitle="Put Bloom on your home screen">
        <PwaInstallButton />
      </Card>

      <Card title="Your data" subtitle="Everything you add belongs to you">
        <p className="text-sm text-muted">
          Download everything you have saved as a file. Chats with Bloom AI are deleted automatically after 30 days.
        </p>
        <button type="button" onClick={exportData} className="btn btn-ghost mt-4 w-full">
          Download my data
        </button>
      </Card>

      <p className="px-2 text-center text-xs text-muted">Bloom 2.1 · Made with 💗</p>
    </>
  );
}
