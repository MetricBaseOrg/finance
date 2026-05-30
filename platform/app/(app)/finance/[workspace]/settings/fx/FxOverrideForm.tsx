"use client";

import { useActionState, useRef, useEffect } from "react";
import { upsertFxOverride, type FxActionState } from "@/server/actions/fx";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function FxOverrideForm({ slug }: { slug: string }) {
  const action = upsertFxOverride.bind(null, slug);
  const [state, formAction, pending] = useActionState<FxActionState, FormData>(
    action,
    {},
  );
  const ref = useRef<HTMLFormElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!pending && !state?.error) ref.current?.reset();
  }, [pending, state]);

  return (
    <form ref={ref} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-4">
        <Eyebrow>Manual override</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[140px_100px_100px_1fr_160px] gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Date
            </span>
            <input
              name="date"
              type="date"
              required
              defaultValue={today}
              className="mb-input mono"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Base
            </span>
            <select name="base" className="mb-input" defaultValue="USD">
              <option value="USD">USD</option>
              <option value="IDR">IDR</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Quote
            </span>
            <select name="quote" className="mb-input" defaultValue="IDR">
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Rate (1 base = X quote)
            </span>
            <input
              name="rate"
              type="number"
              step="0.00000001"
              min="0.00000001"
              required
              placeholder="e.g. 16400"
              className="mb-input mono"
            />
          </label>
          <GoldButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save override"}
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
