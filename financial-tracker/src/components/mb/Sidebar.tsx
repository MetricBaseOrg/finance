"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eyebrow } from "./Eyebrow";
import { METRICBASE_LINKS } from "@/lib/constants";

type Item = { href: string; label: string; external?: boolean };

export function Sidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();

  const sections: { title: string; items: Item[] }[] = [
    {
      title: "Books",
      items: [
        { href: `/app/${workspaceSlug}/dashboard`, label: "Dashboard" },
        { href: `/app/${workspaceSlug}/transactions`, label: "Transactions" },
        { href: `/app/${workspaceSlug}/recurring`, label: "Recurring" },
        { href: `/app/${workspaceSlug}/investments`, label: "Investments" },
        { href: `/app/${workspaceSlug}/accounts`, label: "Accounts" },
        { href: `/app/${workspaceSlug}/budgets`, label: "Budgets" },
      ],
    },
    {
      title: "Analysis",
      items: [
        { href: `/app/${workspaceSlug}/reports/pnl`, label: "P&L" },
        { href: `/app/${workspaceSlug}/reports/balance-sheet`, label: "Balance Sheet" },
      ],
    },
    {
      title: "Settings",
      items: [
        { href: `/app/${workspaceSlug}/settings/workspace`, label: "Workspace" },
        { href: `/app/${workspaceSlug}/settings/categories`, label: "Categories" },
        { href: `/app/${workspaceSlug}/settings/fx`, label: "FX Rates" },
        { href: `/app/${workspaceSlug}/settings/members`, label: "Members" },
        { href: `/app/${workspaceSlug}/settings/activity`, label: "Activity" },
        { href: `/app/profile`, label: "Profile" },
      ],
    },
    {
      title: "MetricBase",
      items: [
        { href: METRICBASE_LINKS.home, label: "Home", external: true },
        { href: METRICBASE_LINKS.energy, label: "Energy", external: true },
        { href: METRICBASE_LINKS.chain, label: "Crypto", external: true },
        { href: METRICBASE_LINKS.saham, label: "Saham", external: true },
        { href: METRICBASE_LINKS.journal, label: "Journal", external: true },
        { href: METRICBASE_LINKS.contact, label: "Contact us", external: true },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col gap-7 border-r border-line bg-sidebar-bg px-3 py-6 overflow-y-auto">
      {sections.map((s) => (
        <div key={s.title} className="flex flex-col gap-1.5">
          <Eyebrow className="no-tick px-2.5">{s.title}</Eyebrow>
          <nav className="flex flex-col gap-px">
            {s.items.map((i) => {
              const active = !i.external && pathname.startsWith(i.href);
              const linkClass = [
                "font-mono text-[11px] uppercase tracking-[0.18em] px-2.5 py-2",
                "flex items-center justify-between gap-2",
                "border-l-2 transition-colors duration-150",
                active
                  ? "text-gold bg-tint-gold-soft border-l-gold"
                  : "text-gray-2 border-l-transparent hover:text-gold hover:bg-tint-gold-hover",
              ].join(" ");

              if (i.external) {
                return (
                  <a
                    key={i.href}
                    href={i.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    <span>{i.label}</span>
                    <span className="text-gray-3 text-[9px]">↗</span>
                  </a>
                );
              }
              return (
                <Link key={i.href} href={i.href} className={linkClass}>
                  {i.label}
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
