"use client";

import { useCallback, useEffect, useState } from "react";

/** A small message that appears above the bottom navigation and fades after a few seconds. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [message]);

  const showToast = useCallback((text: string) => setMessage(text), []);

  const toast = message ? (
    <div
      role="status"
      className="animate-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl bg-ink px-4 py-3 text-center text-sm font-bold text-bg shadow-soft md:bottom-8"
    >
      {message}
    </div>
  ) : null;

  return { toast, showToast };
}
