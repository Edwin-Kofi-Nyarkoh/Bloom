import Link from "next/link";
import { ReactNode } from "react";
import BloomFlower from "@/components/ui/BloomFlower";
import Sticker from "@/components/ui/Sticker";
import ThemeToggle from "@/components/ui/ThemeToggle";

/** Shared frame for the sign in and sign up screens. */
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <main className="bloom-bg flex min-h-screen flex-col px-4 py-5">
      <div className="mx-auto flex w-full max-w-sm items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <BloomFlower size={34} />
          <span className="font-display text-2xl font-semibold text-ink">Bloom</span>
        </Link>
        <ThemeToggle />
      </div>

      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8">
        <div className="relative rounded-3xl border border-line bg-surface p-6 shadow-soft">
          <Sticker emoji="🌷" size={50} tilt={-12} float className="absolute -top-6 right-6" />
          <Sticker emoji="✨" size={38} tilt={10} float className="absolute -left-3 top-16" />
          <h1 className="font-display text-3xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-muted">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </main>
  );
}
