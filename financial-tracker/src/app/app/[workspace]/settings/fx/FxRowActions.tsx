"use client";

import { useTransition } from "react";
import { deleteFxOverride } from "@/server/actions/fx";

export function FxRowActions({ slug, id }: { slug: string; id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => {
        if (!confirm("Delete this manual rate?")) return;
        startTransition(async () => {
          await deleteFxOverride(slug, id);
        });
      }}
      disabled={pending}
      className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] disabled:opacity-50 text-right"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
