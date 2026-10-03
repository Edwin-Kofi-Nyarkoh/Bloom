"use client";

import { useSyncExternalStore } from "react";

// Small helpers for reading browser-only values (localStorage, media queries)
// in a way that renders the same HTML on the server and updates after load.

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function writeStored(key: string, value: string | null) {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
  listeners.forEach((listener) => listener());
}

/** A localStorage value that re-renders the component when it changes. Null on the server. */
export function useStored(key: string) {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(key),
    () => null
  );
}

/** Whether a CSS media query matches, updating live. `serverValue` is used before the page loads. */
export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (listener) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => serverValue
  );
}

const never = () => () => {};

/** A value that only exists in the browser and does not change, such as today's date. */
export function useClientValue<T>(read: () => T, serverValue: T) {
  return useSyncExternalStore(never, read, () => serverValue);
}
