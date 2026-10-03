import Link from "next/link";
import BloomFlower from "@/components/ui/BloomFlower";
import Sticker from "@/components/ui/Sticker";

const FEATURES = [
  { emoji: "📅", title: "Know what's coming", body: "See when your next period and fertile days are likely.", tint: "var(--primary-soft)" },
  { emoji: "😊", title: "One tap a day", body: "Pick a sticker for your mood. That's it.", tint: "var(--sun-soft)" },
  { emoji: "💬", title: "Ask Bloom AI", body: "Private answers to the questions you don't want to ask out loud.", tint: "var(--lilac-soft)" },
];

export default function Home() {
  return (
    <main className="bloom-bg min-h-screen px-4 py-5">
      <div className="mx-auto flex max-w-md flex-col gap-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BloomFlower size={34} />
            <span className="font-display text-2xl font-semibold text-ink">Bloom</span>
          </div>
          <Link href="/login" className="rounded-full px-4 py-2.5 text-sm font-extrabold text-primary-ink">
            Sign in
          </Link>
        </header>

        <section className="relative pt-6 text-center">
          <Sticker emoji="🌷" size={54} tilt={-14} float className="absolute left-2 top-0" />
          <Sticker emoji="💗" size={44} tilt={12} float className="absolute right-3 top-6" />
          <Sticker emoji="✨" size={38} tilt={-6} float className="absolute right-10 top-36" />
          <div className="mx-auto w-fit">
            <BloomFlower size={132} className="floaty" />
          </div>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight text-ink">
            Your cycle,
            <br />
            made simple
          </h1>
          <p className="mx-auto mt-3 max-w-xs text-lg text-muted">
            Track your period, understand your body, and get friendly answers.
          </p>
          <div className="mt-7 flex flex-col gap-3">
            <Link href="/signup" className="btn btn-primary min-h-14 text-lg">
              Get started free
            </Link>
            <Link href="/login" className="btn btn-ghost">
              I already have an account
            </Link>
          </div>
        </section>

        <section className="space-y-3 pb-8">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-soft">
              <Sticker emoji={feature.emoji} size={52} tilt={-6} tint={feature.tint} />
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{feature.title}</h2>
                <p className="text-sm text-muted">{feature.body}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
