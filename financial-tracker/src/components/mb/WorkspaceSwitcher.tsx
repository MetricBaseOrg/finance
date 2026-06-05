"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { NavDiamond } from "./NavDiamond";

type Item = {
  slug: string;
  name: string;
  type: "INDIVIDUAL" | "COMPANY";
  baseCurrency: string;
};

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: Item;
  workspaces: Item[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 px-3 py-2 hover:bg-[rgba(201,168,76,0.06)] transition-colors border border-line min-w-0 max-w-[200px] sm:max-w-none"
      >
        <NavDiamond size={20} />
        <div className="flex flex-col items-start leading-none min-w-0">
          <span className="font-sans text-sm font-bold text-white truncate max-w-[120px] sm:max-w-none">
            {current.name}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-3 mt-1 truncate max-w-[120px] sm:max-w-none">
            {current.type} · {current.baseCurrency}
          </span>
        </div>
        <span className="font-mono text-xs text-gray-3 ml-1 shrink-0">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-[min(288px,calc(100vw-32px))] bg-[var(--color-bg-card)] border border-line shadow-xl z-50">
          <div className="px-3 py-2 border-b border-line">
            <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-3">
              Switch workspace
            </span>
          </div>
          <div className="flex flex-col">
            {workspaces.map((w) => {
              const active = w.slug === current.slug;
              return (
                <Link
                  key={w.slug}
                  href={`/app/${w.slug}/dashboard`}
                  className={`flex items-center justify-between px-3 py-2.5 hover:bg-[var(--color-bg-hover)] transition-colors ${
                    active ? "bg-[rgba(201,168,76,0.06)]" : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <div className="flex flex-col">
                    <span className="font-sans text-sm font-semibold text-white">
                      {w.name}
                    </span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-gray-3 mt-0.5">
                      {w.type} · {w.baseCurrency}
                    </span>
                  </div>
                  {active && (
                    <span className="font-mono text-xs text-gold">●</span>
                  )}
                </Link>
              );
            })}
          </div>
          <div className="border-t border-line">
            <Link
              href="/app/onboarding"
              className="flex items-center gap-2 px-3 py-2.5 hover:bg-[var(--color-bg-hover)] transition-colors font-mono text-[11px] uppercase tracking-[0.18em] text-gold"
              onClick={() => setOpen(false)}
            >
              + New workspace
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
