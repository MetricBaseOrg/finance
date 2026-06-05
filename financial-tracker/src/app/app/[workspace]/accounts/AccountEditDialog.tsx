"use client";

import { useActionState, useEffect, useRef } from "react";
import { updateAccount, type AccountActionState } from "@/server/actions/accounts";
import { GoldButton } from "@/components/mb/GoldButton";
import type { FinAccountType } from "@prisma/client";

const TYPES = ["BANK", "CASH", "CRYPTO", "BROKERAGE", "CREDIT", "OTHER"] as const;

type Props = {
  slug: string;
  account: {
    id: string;
    name: string;
    type: FinAccountType;
    currency: string;
    openingBalance: string;
  };
};

export function AccountEditDialog({ slug, account }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const action = updateAccount.bind(null, slug);
  const [state, formAction, pending] = useActionState<AccountActionState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (!pending && !state?.error && state !== undefined) {
      dialogRef.current?.close();
    }
  }, [pending, state]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => formRef.current?.reset();
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors"
      >
        Edit
      </button>

      <dialog
        ref={dialogRef}
        className="bg-[var(--color-bg-elev)] border border-line text-gray-1 p-0 w-full max-w-md m-auto backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <form ref={formRef} action={formAction} className="flex flex-col gap-5 p-6">
          <h2 className="font-sans text-base font-bold text-white">Edit account</h2>

          <input type="hidden" name="id" value={account.id} />

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Name
            </span>
            <input
              name="name"
              required
              maxLength={60}
              defaultValue={account.name}
              className="mb-input"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Type
              </span>
              <select name="type" defaultValue={account.type} className="mb-input">
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
              <select name="currency" defaultValue={account.currency} className="mb-input">
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Opening balance
            </span>
            <input
              name="openingBalance"
              type="number"
              step="0.01"
              defaultValue={account.openingBalance}
              className="mb-input mono"
            />
          </label>

          {state?.error && (
            <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>
          )}

          <div className="flex items-center justify-end gap-4 pt-1">
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <GoldButton type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </GoldButton>
          </div>
        </form>
      </dialog>
    </>
  );
}
