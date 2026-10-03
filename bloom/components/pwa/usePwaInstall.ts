"use client";

import { useState, useSyncExternalStore } from "react";
import { useClientValue, useMediaQuery } from "@/lib/browserStore";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// The browser fires this once per page load, often before the component that
// wants it has mounted, so it is kept here for whichever screen asks later.
let savedPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function setSavedPrompt(prompt: InstallPromptEvent | null) {
  savedPrompt = prompt;
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    setSavedPrompt(event as InstallPromptEvent);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePwaInstall() {
  const canInstall = useSyncExternalStore(
    subscribe,
    () => savedPrompt !== null,
    () => false
  );
  const standalone = useMediaQuery("(display-mode: standalone)");
  const isIos = useClientValue(() => /iphone|ipad|ipod/i.test(navigator.userAgent), false);
  const [justInstalled, setJustInstalled] = useState(false);

  const install = async () => {
    const prompt = savedPrompt;
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setSavedPrompt(null);
    if (outcome === "accepted") setJustInstalled(true);
  };

  return { canInstall, isInstalled: standalone || justInstalled, isIos, install };
}
