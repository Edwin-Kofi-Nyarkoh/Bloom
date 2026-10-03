export type StickerItem = {
  id: string;
  emoji: string;
  label: string;
  /** Soft background tint for the sticker tile. */
  tint: string;
};

// The label is what gets saved as the day's mood.
export const BLOOM_STICKERS: StickerItem[] = [
  { id: "happy", emoji: "😊", label: "Happy", tint: "var(--sun-soft)" },
  { id: "calm", emoji: "😌", label: "Calm", tint: "var(--mint-soft)" },
  { id: "energetic", emoji: "⚡", label: "Energetic", tint: "var(--sun-soft)" },
  { id: "loved", emoji: "🥰", label: "Loved", tint: "var(--primary-soft)" },
  { id: "tired", emoji: "😴", label: "Tired", tint: "var(--lilac-soft)" },
  { id: "sensitive", emoji: "🥺", label: "Sensitive", tint: "var(--lilac-soft)" },
  { id: "moody", emoji: "😤", label: "Moody", tint: "var(--primary-soft)" },
  { id: "crampy", emoji: "😣", label: "Crampy", tint: "var(--primary-soft)" },
  { id: "bloated", emoji: "🫧", label: "Bloated", tint: "var(--mint-soft)" },
  { id: "cravings", emoji: "🍫", label: "Cravings", tint: "var(--peach-soft)" },
];

export function findSticker(mood?: string | null): StickerItem | undefined {
  if (!mood) return undefined;
  const lower = mood.toLowerCase();
  return BLOOM_STICKERS.find((sticker) => sticker.label.toLowerCase() === lower || sticker.id === lower);
}
