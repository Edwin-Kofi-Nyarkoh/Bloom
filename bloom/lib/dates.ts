// Calendar dates are handled as "YYYY-MM-DD" keys so the same maths works on the
// server and in the browser regardless of time zone. The database stores each
// date as UTC midnight, so the first 10 characters of its ISO string are the key.

export type DateKey = string;

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toKey(value: string | Date): DateKey {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

export function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(keyToMs(value));
}

/** Today's date in the device's own time zone. */
export function todayKey(): DateKey {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function keyToMs(key: DateKey) {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDays(key: DateKey, days: number): DateKey {
  return new Date(keyToMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function diffDays(from: DateKey, to: DateKey) {
  return Math.round((keyToMs(to) - keyToMs(from)) / DAY_MS);
}

export function formatKey(
  key: DateKey,
  options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
) {
  return new Date(keyToMs(key)).toLocaleDateString("en-US", { ...options, timeZone: "UTC" });
}

export function formatRange(start: DateKey, end: DateKey) {
  return `${formatKey(start)} – ${formatKey(end)}`;
}
