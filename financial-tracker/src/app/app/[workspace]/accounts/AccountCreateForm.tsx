"use client";

import { useActionState, useRef, useEffect } from "react";
import { createAccount, type AccountActionState } from "@/server/actions/accounts";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

const TYPES = [
  "BANK",
  "CASH",
  "CRYPTO",
  "BROKERAGE",
  "CREDIT",
  "OTHER",
] as const;

export function AccountCreateForm({
  slug,
  workspaceBase,
}: {
  slug: string;
  workspaceBase: string;
}) {
  const action = createAccount.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-4">
        <Eyebrow>New account</Eyebrow>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.4fr_140px_120px_160px_160px] gap-3 items-end">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Name
            </span>
            <input
              name="name"
              required
              maxLength={60}
              placeholder="BCA · Operating"
              className="mb-input"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Type
            </span>
            <select name="type" className="mb-input" defaultValue="BANK">
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Currency
            </span>
            <select
              name="currency"
              className="mb-input"
              defaultValue={workspaceBase}
            >
              <option value="IDR">IDR</option>
              <option value="USD">USD</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Opening balance
            </span>
            <input
              name="openingBalance"
              type="number"
              step="0.01"
              defaultValue="0"
              className="mb-input mono"
            />
          </label>
          <GoldButton type="submit" variant="primary" disabled={pending}>
            {pending ? "Adding…" : "Add account"}
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
