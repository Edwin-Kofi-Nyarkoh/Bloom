import Link from "next/link";
import BloomFlower from "@/components/ui/BloomFlower";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { SettingsIcon } from "@/components/ui/icons";

/** Slim header for phones: logo on the left, theme and settings on the right. */
export default function Topbar() {
  return (
    <header className="flex items-center justify-between md:hidden">
      <Link href="/dashboard" className="flex items-center gap-2">
        <BloomFlower size={34} />
        <span className="font-display text-2xl font-semibold text-ink">Bloom</span>
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink"
        >
          <SettingsIcon size={20} />
        </Link>
      </div>
    </header>
  );
}
