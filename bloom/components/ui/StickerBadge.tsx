"use client";

import { StickerItem } from "@/lib/stickers";

interface StickerBadgeProps {
  sticker: StickerItem;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** A tappable mood sticker with its label underneath. */
export default function StickerBadge({ sticker, selected = false, disabled = false, onClick }: StickerBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className="flex w-[4.5rem] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-2xl p-1.5 transition active:scale-95 disabled:cursor-default"
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border-[3px] text-2xl transition ${
          selected ? "scale-110 border-primary shadow-soft" : "border-surface"
        }`}
        style={{ background: sticker.tint }}
        aria-hidden="true"
      >
        {sticker.emoji}
      </span>
      <span className={`text-xs font-bold ${selected ? "text-primary-ink" : "text-muted"}`}>{sticker.label}</span>
    </button>
  );
}
