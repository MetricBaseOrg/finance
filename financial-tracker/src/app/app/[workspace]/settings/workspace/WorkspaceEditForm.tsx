"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  updateWorkspace,
  type UpdateWorkspaceState,
} from "@/server/actions/workspaces";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function WorkspaceEditForm({
  slug,
  initial,
  currencyLocked,
  txnCount,
}: {
  slug: string;
  initial: { name: string; type: "INDIVIDUAL" | "COMPANY"; baseCurrency: string };
  currencyLocked: boolean;
  txnCount: number;
}) {
  const router = useRouter();
  const action = updateWorkspace.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    UpdateWorkspaceState,
    FormData
  >(action, {});

  return (
    <form action={formAction} className="mb-card p-6 flex flex-col gap-5">
      <Eyebrow>Edit workspace</Eyebrow>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Name
        </span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          defaultValue={initial.name}
          className="mb-input"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Type
        </span>
        <div className="grid grid-cols-2 gap-3">
          {(["INDIVIDUAL", "COMPANY"] as const).map((v) => (
            <label
              key={v}
              className="border border-line p-4 cursor-pointer hover:border-gold has-checked:border-gold has-checked:bg-[rgba(201,168,76,0.05)] transition-colors flex flex-col gap-1"
            >
              <input
                type="radio"
                name="type"
                value={v}
                defaultChecked={initial.type === v}
                className="sr-only"
              />
              <span className="font-sans text-base font-bold text-white">
                {v === "INDIVIDUAL" ? "Individual" : "Company"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-3">
                {v === "INDIVIDUAL" ? "Personal books" : "Business books"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Base currency
          </span>
          {currencyLocked && (
            <span className="font-mono text-[10px] text-gray-3">
              Locked · {txnCount} txn{txnCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {(["IDR", "USD"] as const).map((v) => (
            <label
              key={v}
              className={`border p-4 transition-colors flex flex-col gap-1 ${
                currencyLocked
                  ? "border-line opacity-50 cursor-not-allowed"
                  : "border-line cursor-pointer hover:border-gold has-checked:border-gold has-checked:bg-[rgba(201,168,76,0.05)]"
              }`}
            >
              <input
                type="radio"
                name="baseCurrency"
                value={v}
                defaultChecked={initial.baseCurrency === v}
                disabled={currencyLocked}
                className="sr-only"
              />
              <span className="font-sans text-base font-bold text-white mono">
                {v}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-3">
                {v === "IDR" ? "Indonesian Rupiah" : "US Dollar"}
              </span>
            </label>
          ))}
        </div>
        {currencyLocked && (
          <p className="font-mono text-[10px] text-gray-3 mt-1">
            Currency cannot be changed once transactions exist — it would
            invalidate the FX rates stamped on every existing entry.
          </p>
        )}
      </fieldset>

      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="font-mono text-xs text-[var(--color-up)]">
          Saved.
        </p>
      )}

      <div className="flex gap-3">
        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </GoldButton>
        <button
          type="button"
          onClick={() => router.push(`/app/${slug}/dashboard`)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors px-4 py-2.5 border border-line hover:border-gold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
