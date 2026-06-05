"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function AuditFilters({
  actions,
  entities,
  members,
}: {
  actions: string[];
  entities: string[];
  members: { id: string; email: string }[];
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
      <div
        className={`grid grid-cols-2 md:grid-cols-5 gap-2 ${pending ? "opacity-60" : ""}`}
      >
        <select
          value={sp.get("action") ?? ""}
          onChange={(e) => update("action", e.target.value)}
          className="mb-input"
          aria-label="Action"
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={sp.get("entity") ?? ""}
          onChange={(e) => update("entity", e.target.value)}
          className="mb-input"
          aria-label="Entity"
        >
          <option value="">All entities</option>
          {entities.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <select
          value={sp.get("member") ?? ""}
          onChange={(e) => update("member", e.target.value)}
          className="mb-input"
          aria-label="Member"
        >
          <option value="">All members</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.email}
            </option>
          ))}
        </select>
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
      </div>
    </div>
  );
}
