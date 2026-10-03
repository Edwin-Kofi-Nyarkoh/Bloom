"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { useMediaQuery, useStored, writeStored } from "@/lib/browserStore";

type ThemeMode = "system" | "light" | "dark";

type ThemeContextValue = {
  mode: ThemeMode;
  resolved: "light" | "dark";
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
};

const STORAGE_KEY = "bloom_theme_mode";

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useStored(STORAGE_KEY);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");

  const mode: ThemeMode = stored === "light" || stored === "dark" ? stored : "system";
  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.documentElement.style.colorScheme = resolved;
  }, [resolved]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      resolved,
      setMode: (next) => writeStored(STORAGE_KEY, next),
      toggle: () => writeStored(STORAGE_KEY, resolved === "dark" ? "light" : "dark"),
    }),
    [mode, resolved]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeProvider");
  }
  return context;
}
