"use client";

import { useTransition } from "react";
import { deleteCategory } from "@/server/actions/categories";

export function CategoryRowActions({
  slug,
  id,
}: {
  slug: string;
  id: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await deleteCategory(slug, id);
        })
      }
      disabled={pending}
      className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors text-right disabled:opacity-50"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
