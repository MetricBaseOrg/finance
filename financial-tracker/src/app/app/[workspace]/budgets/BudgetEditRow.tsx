"use client";

import { useState, useTransition } from "react";
import { updateCategory } from "@/server/actions/categories";

export function BudgetEditRow({
  slug,
  id,
  currentBudget,
}: {
  slug: string;
  id: string;
  currentBudget: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    currentBudget !== null ? String(currentBudget) : "",
  );
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold text-right transition-colors"
      >
        Edit
      </button>
    );
  }

  function save() {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("monthlyBudget", value);
    startTransition(async () => {
      await updateCategory(slug, fd);
      setEditing(false);
    });
  }

  return (
    <div className="flex items-center gap-1 justify-end">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        className="mb-input mono text-xs py-1 px-2 w-20"
        placeholder="—"
      />
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright disabled:opacity-50"
      >
        {pending ? "…" : "✓"}
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold"
      >
        ✕
      </button>
    </div>
  );
}
