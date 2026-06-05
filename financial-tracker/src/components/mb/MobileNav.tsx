"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Eyebrow } from "./Eyebrow";
import { signOutAction } from "@/server/actions/auth";
import { METRICBASE_LINKS } from "@/lib/constants";

type Item = { href: string; label: string; external?: boolean };

export function MobileNav({ workspaceSlug }: { workspaceSlug: string }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open]);

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
        {
          href: `/app/${workspaceSlug}/reports/balance-sheet`,
          label: "Balance Sheet",
        },
      ],
    },
    {
      title: "Settings",
      items: [
        { href: `/app/${workspaceSlug}/settings/workspace`, label: "Workspace" },
        {
          href: `/app/${workspaceSlug}/settings/categories`,
          label: "Categories",
        },
        { href: `/app/${workspaceSlug}/settings/fx`, label: "FX Rates" },
        {
          href: `/app/${workspaceSlug}/settings/members`,
          label: "Members",
        },
        {
          href: `/app/${workspaceSlug}/settings/activity`,
          label: "Activity",
        },
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
    <>
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden inline-flex items-center gap-2 px-3 h-10 border border-gold bg-[rgba(201,168,76,0.08)] hover:bg-gold hover:text-black transition-colors text-gold"
      >
        <span className="flex flex-col gap-1">
          <span className="block w-4 h-[2px] bg-current" />
          <span className="block w-4 h-[2px] bg-current" />
          <span className="block w-4 h-[2px] bg-current" />
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold">
          Menu
        </span>
      </button>

      {open && mounted && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <nav
            onClick={(e) => e.stopPropagation()}
            className="absolute right-0 top-0 bottom-0 w-[280px] max-w-[85vw] bg-[var(--color-bg-elev)] border-l border-line flex flex-col overflow-y-auto"
          >
            <div className="flex justify-between items-center h-16 px-5 border-b border-line shrink-0">
              <Eyebrow>Menu</Eyebrow>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="font-mono text-sm text-gray-2 hover:text-gold w-8 h-8 flex items-center justify-center border border-line hover:border-gold transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="flex flex-col gap-8 px-2 py-6 flex-1">
              {sections.map((s) => (
                <div key={s.title} className="flex flex-col gap-2">
                  <Eyebrow className="px-3">{s.title}</Eyebrow>
                  <div className="flex flex-col gap-px">
                    {s.items.map((i) => {
                      if (i.external) {
                        return (
                          <a
                            key={i.href}
                            href={i.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpen(false)}
                            className="font-mono text-[12px] uppercase tracking-[0.18em] px-3 py-3 text-gray-1 hover:text-gold hover:bg-[rgba(201,168,76,0.06)] transition-colors flex items-center justify-between"
                          >
                            <span>{i.label}</span>
                            <span className="text-gray-3 text-[10px]">↗</span>
                          </a>
                        );
                      }
                      const active = pathname === i.href;
                      return (
                        <Link
                          key={i.href}
                          href={i.href}
                          className={`font-mono text-[12px] uppercase tracking-[0.18em] px-3 py-3 transition-colors ${
                            active
                              ? "text-gold bg-[rgba(201,168,76,0.08)]"
                              : "text-gray-1 hover:text-gold hover:bg-[rgba(201,168,76,0.06)]"
                          }`}
                        >
                          {i.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <form action={signOutAction} className="border-t border-line p-4 shrink-0">
              <button
                type="submit"
                className="w-full font-mono text-[12px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold border border-line hover:border-gold py-3 transition-colors"
              >
                Sign out
              </button>
            </form>
          </nav>
        </div>,
        document.body,
      )}
    </>
  );
}
