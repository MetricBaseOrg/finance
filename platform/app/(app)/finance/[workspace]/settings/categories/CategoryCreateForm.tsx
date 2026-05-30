"use client";

import { useActionState, useRef, useEffect } from "react";
import {
  createCategory,
  type CategoryActionState,
} from "@/server/actions/categories";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function CategoryCreateForm({ slug }: { slug: string }) {
  const action = createCategory.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    CategoryActionState,
    FormData
  >(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-4">
        <Eyebrow>New category</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_140px_160px_160px] gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Name
            </span>
            <input
              name="name"
              required
              maxLength={60}
              placeholder="e.g. Marketing"
              className="mb-input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Kind
            </span>
            <select name="kind" className="mb-input" defaultValue="EXPENSE">
              <option value="EXPENSE">Expense</option>
              <option value="INCOME">Income</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Monthly budget (optional)
            </span>
            <input
              name="monthlyBudget"
              type="number"
              step="0.01"
              min="0"
              placeholder="—"
              className="mb-input mono"
            />
          </label>
          <GoldButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add category"}
          </GoldButton>
        </div>
        {state?.error && (
          <p className="font-mono text-xs text-[var(--color-down)]">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
