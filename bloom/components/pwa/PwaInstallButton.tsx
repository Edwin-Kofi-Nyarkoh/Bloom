"use client";

import { usePwaInstall } from "./usePwaInstall";

/** Install control for the Settings screen, with written steps where the browser has no install prompt. */
export default function PwaInstallButton() {
  const { canInstall, isInstalled, isIos, install } = usePwaInstall();

  if (isInstalled) {
    return <p className="text-sm font-bold text-mint">Bloom is installed on this device ✓</p>;
  }

  if (canInstall) {
    return (
      <button type="button" onClick={install} className="btn btn-primary w-full">
        Install Bloom
      </button>
    );
  }

  return (
    <p className="rounded-2xl bg-bg p-3 text-sm text-muted">
      {isIos
        ? "On iPhone: tap the Share button in Safari, then “Add to Home Screen”."
        : "Open your browser menu and choose “Install app” or “Add to Home screen”."}
    </p>
  );
}
