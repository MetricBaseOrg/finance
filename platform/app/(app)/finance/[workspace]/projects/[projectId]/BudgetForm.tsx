"use client";

import { useActionState } from "react";
import { setProjectBudget, type BudgetActionState } from "@/server/actions/project-budget";
import { GoldButton } from "@/components/mb/GoldButton";

export function BudgetForm({
  slug,
  projectId,
  initial,
  base,
}: {
  slug: string;
  projectId: string;
  initial: number | null;
  base: string;
}) {
  const action = setProjectBudget.bind(null, slug, projectId);
  const [state, formAction, pending] = useActionState<BudgetActionState, FormData>(action, {});

  return (
    <form action={formAction} className="flex items-end gap-3 flex-wrap">
      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Budget · {base}
        </span>
        <input
          name="budget"
          type="number"
          step="0.01"
          min="0"
          defaultValue={initial ?? ""}
          placeholder="No budget"
          className="mb-input mono"
        />
      </label>
      <GoldButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save budget"}
      </GoldButton>
      {state?.error && <span className="font-mono text-xs text-[var(--color-down)]">{state.error}</span>}
      {state?.ok && <span className="font-mono text-xs text-[var(--color-up)]">Saved</span>}
    </form>
  );
}
