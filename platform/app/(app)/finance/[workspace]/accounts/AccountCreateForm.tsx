"use client";

import { useActionState, useRef, useEffect, useState } from "react";
import { createAccount, type AccountActionState } from "@/server/actions/accounts";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

const TYPES = [
  "BANK",
  "CASH",
  "CRYPTO",
  "BROKERAGE",
  "CREDIT",
  "PROJECT",
  "OTHER",
] as const;

export function AccountCreateForm({
  slug,
  workspaceBase,
  projects = [],
}: {
  slug: string;
  workspaceBase: string;
  projects?: { id: string; name: string }[];
}) {
  const action = createAccount.bind(null, slug);
  const [state, formAction, pending] = useActionState<
    AccountActionState,
    FormData
  >(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [type, setType] = useState<string>("BANK");

  useEffect(() => {
    if (!pending && !state?.error) {
      formRef.current?.reset();
      setType("BANK");
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
            <select name="type" className="mb-input" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {type === "PROJECT" && (
            <label className="flex flex-col gap-1.5 sm:col-span-2 md:col-span-5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Linked project
              </span>
              <select name="projectId" className="mb-input" required defaultValue="">
                <option value="" disabled>Select a project…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {projects.length === 0 && (
                <span className="font-mono text-[10px] text-gray-3">No projects yet — create one in /projects first.</span>
              )}
            </label>
          )}
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
