"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  createPosition,
  type InvestmentActionState,
} from "@/server/actions/investments";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function PositionCreateForm({
  slug,
  accounts,
}: {
  slug: string;
  accounts: { id: string; name: string; currency: string }[];
}) {
  const action = createPosition.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    InvestmentActionState,
    FormData
  >(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6 flex flex-col gap-4">
      <Eyebrow>New position</Eyebrow>
      <div className="grid grid-cols-1 sm:grid-cols-[1.4fr_120px_1.4fr_160px] gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Brokerage account
          </span>
          <select name="finAccountId" required className="mb-input">
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} · {a.currency}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Symbol
          </span>
          <input
            name="symbol"
            required
            maxLength={20}
            placeholder="AAPL"
            className="mb-input mono uppercase"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Name (optional)
          </span>
          <input
            name="name"
            maxLength={80}
            placeholder="Apple Inc."
            className="mb-input"
          />
        </label>
        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Adding…" : "Add position"}
        </GoldButton>
      </div>
      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>
      )}
    </form>
  );
}
