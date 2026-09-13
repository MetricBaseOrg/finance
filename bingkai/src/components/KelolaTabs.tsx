"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function KelolaTabs({ manageKey }: { manageKey: string }) {
  const path = usePathname();
  const base = `/kelola/${manageKey}`;
  const tabs = [
    { href: base, label: "Statistik" },
    { href: `${base}/pengaturan`, label: "Pengaturan" },
  ];
  return (
    <nav className="flex gap-1 border-b border-line" aria-label="Menu kelola">
      {tabs.map((t) => {
        const active = path === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-2 font-mono text-[11px] uppercase tracking-wider ${
              active ? "border-gold text-gold" : "border-transparent text-gray-2 hover:text-gold"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
