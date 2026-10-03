import { CSSProperties } from "react";

interface StickerProps {
  emoji: string;
  /** Diameter in pixels. */
  size?: number;
  /** Tilt in degrees, for a hand-placed feel. */
  tilt?: number;
  tint?: string;
  float?: boolean;
  className?: string;
}

/** A decorative die-cut sticker. Hidden from screen readers because it carries no meaning. */
export default function Sticker({ emoji, size = 48, tilt = -6, tint, float = false, className = "" }: StickerProps) {
  const style = {
    width: size,
    height: size,
    fontSize: size * 0.52,
    transform: `rotate(${tilt}deg)`,
    "--tilt": `${tilt}deg`,
    ...(tint ? { background: tint } : {}),
  } as CSSProperties;

  return (
    <span aria-hidden="true" className={`sticker shrink-0 ${float ? "floaty" : ""} ${className}`} style={style}>
      {emoji}
    </span>
  );
}
