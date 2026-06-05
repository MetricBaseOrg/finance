"use client";

import { useActionState } from "react";
import { createWorkspace, type CreateWorkspaceState } from "@/server/actions/workspaces";
import { GoldButton } from "@/components/mb/GoldButton";

export function OnboardingForm() {
  const [state, formAction, pending] = useActionState<
    CreateWorkspaceState,
    FormData
  >(createWorkspace, {});

  return (
    <form action={formAction} className="mb-card p-8 flex flex-col gap-6">
      <label className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
          Workspace name
        </span>
        <input
          name="name"
          required
          minLength={2}
          maxLength={60}
          placeholder="e.g. Personal · IDR  or  Acme Pte Ltd"
          className="mb-input"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
          Type
        </span>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "INDIVIDUAL", t: "Individual", d: "Personal books" },
            { v: "COMPANY", t: "Company", d: "Business books" },
          ].map((o, i) => (
            <label
              key={o.v}
              className="border border-line p-4 cursor-pointer hover:border-gold has-checked:border-gold has-checked:bg-[rgba(201,168,76,0.05)] transition-colors flex flex-col gap-1"
            >
              <input
                type="radio"
                name="type"
                value={o.v}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <span className="font-sans text-base font-bold text-white">
                {o.t}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-3">
                {o.d}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-gray-2">
          Base currency
        </span>
        <div className="grid grid-cols-2 gap-3">
          {[
            { v: "IDR", t: "IDR", d: "Indonesian Rupiah" },
            { v: "USD", t: "USD", d: "US Dollar" },
          ].map((o, i) => (
            <label
              key={o.v}
              className="border border-line p-4 cursor-pointer hover:border-gold has-checked:border-gold has-checked:bg-[rgba(201,168,76,0.05)] transition-colors flex flex-col gap-1"
            >
              <input
                type="radio"
                name="baseCurrency"
                value={o.v}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <span className="font-sans text-base font-bold text-white mono">
                {o.t}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-gray-3">
                {o.d}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          {state.error}
        </p>
      )}

      <GoldButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Creating…" : "Create workspace"}
      </GoldButton>
    </form>
  );
}
