"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function TransactionFilters({
  slug: _slug,
  accounts,
  categories,
}: {
  slug: string;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; kind: "INCOME" | "EXPENSE" }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(sp);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  function clearAll() {
    startTransition(() => router.replace(pathname));
  }

  const hasFilters = Array.from(sp.keys()).some((k) => k !== "page");

  return (
    <div className="mb-card p-4">
      <div className="flex justify-between items-center mb-3">
        <Eyebrow>Filter</Eyebrow>
        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold"
          >
            ✕ Clear all
          </button>
        )}
      </div>
      <div className={`grid grid-cols-2 md:grid-cols-6 gap-2 ${pending ? "opacity-60" : ""}`}>
        <input
          type="date"
          value={sp.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className="mb-input mono"
          aria-label="From date"
        />
        <input
          type="date"
          value={sp.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className="mb-input mono"
          aria-label="To date"
        />
        <select
          value={sp.get("type") ?? ""}
          onChange={(e) => update("type", e.target.value)}
          className="mb-input"
          aria-label="Type"
        >
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
          <option value="TRANSFER">Transfer</option>
        </select>
        <select
          value={sp.get("acct") ?? ""}
          onChange={(e) => update("acct", e.target.value)}
          className="mb-input"
          aria-label="Account"
        >
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={sp.get("cat") ?? ""}
          onChange={(e) => update("cat", e.target.value)}
          className="mb-input"
          aria-label="Category"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              [{c.kind[0]}] {c.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={sp.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Search memo…"
          className="mb-input"
          aria-label="Search"
        />
      </div>
    </div>
  );
}
