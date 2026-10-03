"use client";

import { useStored, writeStored } from "@/lib/browserStore";
import Sticker from "@/components/ui/Sticker";
import { usePwaInstall } from "./usePwaInstall";

const DISMISS_KEY = "bloom_install_dismissed";

/** One small, dismissible nudge to add Bloom to the home screen. */
export default function PwaInstallBanner() {
  const { canInstall, isInstalled, install } = usePwaInstall();
  const dismissed = useStored(DISMISS_KEY) === "1";

  if (isInstalled || dismissed || !canInstall) return null;

  return (
    <div className="flex items-center gap-3 rounded-3xl border border-line bg-lilac-soft p-4">
      <Sticker emoji="📲" size={44} tilt={-8} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-extrabold text-ink">Add Bloom to your home screen</p>
        <p className="text-xs text-muted">Opens like an app, one tap away.</p>
      </div>
      <button type="button" onClick={install} className="btn btn-primary min-h-10 px-4 text-sm">
        Install
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => writeStored(DISMISS_KEY, "1")}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-lg text-muted"
      >
        ×
      </button>
    </div>
  );
}
