"use client";

import { useActionState, useState, useRef, useEffect } from "react";
import {
  createTransaction,
  type TxnActionState,
} from "@/server/actions/transactions";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };

export function TransactionCreateForm({
  slug,
  accounts,
  categories,
}: {
  slug: string;
  accounts: Account[];
  categories: Category[];
}) {
  const action = createTransaction.bind(null, slug);
  const [state, formAction, pending] = useActionState<TxnActionState, FormData>(
    action,
    {},
  );
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [primaryAcct, setPrimaryAcct] = useState<string>(accounts[0]?.id ?? "");
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const filteredCategories = categories.filter((c) =>
    type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE",
  );
  const currency = accounts.find((a) => a.id === primaryAcct)?.currency ?? "";

  useEffect(() => {
    if (!pending && !state?.error && state !== undefined) {
      // close on success
      if (open) {
        formRef.current?.reset();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  if (!open) {
    return (
      <div className="flex justify-end">
        <GoldButton
          type="button"
          variant="primary"
          onClick={() => setOpen(true)}
        >
          + New transaction
        </GoldButton>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <Eyebrow>New transaction</Eyebrow>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold"
          >
            ✕ Close
          </button>
        </div>

        {/* Type selector */}
        <div className="grid grid-cols-3 gap-2">
          {(["EXPENSE", "INCOME", "TRANSFER"] as const).map((t) => (
            <label
              key={t}
              className={`border p-3 cursor-pointer text-center transition-colors font-mono text-xs uppercase tracking-[0.18em] ${
                type === t
                  ? "border-gold text-gold bg-[rgba(201,168,76,0.06)]"
                  : "border-line text-gray-2 hover:border-gold/50"
              }`}
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={type === t}
                onChange={() => setType(t)}
                className="sr-only"
              />
              {t}
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Date
            </span>
            <input
              type="date"
              name="date"
              required
              defaultValue={today}
              className="mb-input mono"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Amount {currency && <span className="text-gold">· {currency}</span>}
            </span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              className="mb-input mono"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              {type === "TRANSFER" ? "From account" : "Account"}
            </span>
            <select
              name="finAccountId"
              required
              value={primaryAcct}
              onChange={(e) => setPrimaryAcct(e.target.value)}
              className="mb-input"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </label>

          {type === "TRANSFER" ? (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                To account
              </span>
              <select
                name="counterAccountId"
                required
                className="mb-input"
                defaultValue={accounts[1]?.id ?? ""}
              >
                {accounts
                  .filter((a) => a.id !== primaryAcct)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.currency}
                    </option>
                  ))}
              </select>
            </label>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
                Category
              </span>
              <select name="categoryId" className="mb-input" defaultValue="">
                <option value="">— Uncategorized —</option>
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Memo (optional)
          </span>
          <input
            name="memo"
            maxLength={200}
            placeholder="What was this for?"
            className="mb-input"
          />
        </label>

        {state?.error && (
          <p className="font-mono text-xs text-[var(--color-down)]">
            {state.error}
          </p>
        )}

        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save transaction"}
        </GoldButton>
      </div>
    </form>
  );
}
