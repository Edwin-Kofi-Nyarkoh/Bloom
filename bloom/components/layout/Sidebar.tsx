"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import BloomFlower from "@/components/ui/BloomFlower";
import ThemeToggle from "@/components/ui/ThemeToggle";
import { SettingsIcon } from "@/components/ui/icons";
import { NAV_LINKS } from "./navLinks";

/** Side navigation shown on tablets and desktops. Phones use BottomNav instead. */
export default function Sidebar() {
  const pathname = usePathname();
  const links = [...NAV_LINKS, { href: "/settings", label: "Settings", Icon: SettingsIcon }];

  return (
    <aside className="sticky top-6 hidden w-56 shrink-0 flex-col gap-6 self-start rounded-3xl border border-line bg-surface p-5 shadow-soft md:flex">
      <Link href="/dashboard" className="flex items-center gap-2.5">
        <BloomFlower size={36} />
        <span className="font-display text-2xl font-semibold text-ink">Bloom</span>
      </Link>

      <nav aria-label="Main" className="flex flex-col gap-1">
        {links.map(({ href, label, Icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-[15px] font-bold transition ${
                isActive ? "bg-primary-soft text-primary-ink" : "text-muted hover:bg-bg hover:text-ink"
              }`}
            >
              <Icon size={20} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center justify-between border-t border-line pt-4">
        <span className="text-sm font-bold text-muted">Light / dark</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
