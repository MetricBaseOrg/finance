"use client";

import { useState, useTransition } from "react";
import { Money } from "@/components/mb/Money";
import { GoldButton } from "@/components/mb/GoldButton";
import { updateCategory, deleteCategory } from "@/server/actions/categories";

type Category = {
  id: string;
  name: string;
  monthlyBudget: { toString(): string } | null;
};

export function CategoryRow({
  category,
  slug,
  base,
}: {
  category: Category;
  slug: string;
  base: string;
}) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", category.id);
    startTransition(async () => {
      await updateCategory(slug, fd);
      setEditing(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteCategory(slug, category.id);
    });
  }

  if (editing) {
    return (
      <form
        onSubmit={handleUpdate}
        className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_140px_80px] gap-2 px-4 py-3 border-b border-line last:border-b-0 items-center bg-[var(--color-bg-hover)]"
      >
        <input
          name="name"
          defaultValue={category.name}
          required
          maxLength={60}
          className="mb-input text-sm py-1.5"
        />
        <input
          name="monthlyBudget"
          type="number"
          step="0.01"
          min="0"
          defaultValue={category.monthlyBudget?.toString() ?? ""}
          placeholder="—"
          className="mb-input mono text-sm py-1.5"
        />
        <div className="flex gap-2 justify-end">
          <GoldButton type="submit" variant="primary" disabled={pending} className="text-[10px] px-2 py-1.5">
            {pending ? "…" : "Save"}
          </GoldButton>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 hover:text-gold transition-colors"
          >
            ✕
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_80px_60px] sm:grid-cols-[1fr_140px_80px] gap-2 px-4 py-3 border-b border-line last:border-b-0 items-center hover:bg-[var(--color-bg-hover)] transition-colors">
      <span className="font-sans text-white text-sm truncate">{category.name}</span>
      <span className="mono text-xs text-gray-2 text-right sm:text-left">
        {category.monthlyBudget ? (
          <Money value={category.monthlyBudget.toString()} currency={base} />
        ) : (
          <span className="text-gray-3">—</span>
        )}
      </span>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-50"
        >
          {pending ? "…" : "Del"}
        </button>
      </div>
    </div>
  );
}
