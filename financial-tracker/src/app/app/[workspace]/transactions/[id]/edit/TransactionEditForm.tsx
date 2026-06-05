"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateTransaction,
  type TxnActionState,
} from "@/server/actions/transactions";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };
type TxnType = "INCOME" | "EXPENSE" | "TRANSFER";

export function TransactionEditForm({
  slug,
  id,
  initial,
  accounts,
  categories,
}: {
  slug: string;
  id: string;
  initial: {
    date: string;
    type: TxnType;
    finAccountId: string;
    counterAccountId: string | null;
    categoryId: string | null;
    amount: string;
    memo: string | null;
  };
  accounts: Account[];
  categories: Category[];
}) {
  const router = useRouter();
  const action = updateTransaction.bind(null, slug, id);
  const [state, formAction, pending] = useActionState<TxnActionState, FormData>(
    async (prev, fd) => {
      const next = await action(prev, fd);
      if (!next?.error) {
        router.push(`/app/${slug}/transactions`);
      }
      return next;
    },
    {},
  );
  const [type, setType] = useState<TxnType>(initial.type);
  const [primaryAcct, setPrimaryAcct] = useState<string>(initial.finAccountId);

  const filteredCategories = categories.filter((c) =>
    type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE",
  );
  const currency = accounts.find((a) => a.id === primaryAcct)?.currency ?? "";

  return (
    <form action={formAction} className="mb-card p-6 flex flex-col gap-5">
      <Eyebrow>Edit details</Eyebrow>

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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Date
          </span>
          <input
            type="date"
            name="date"
            required
            defaultValue={initial.date}
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
            defaultValue={initial.amount}
            className="mb-input mono"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              defaultValue={initial.counterAccountId ?? ""}
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
            <select
              name="categoryId"
              className="mb-input"
              defaultValue={initial.categoryId ?? ""}
            >
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
          Memo
        </span>
        <input
          name="memo"
          maxLength={200}
          defaultValue={initial.memo ?? ""}
          placeholder="What was this for?"
          className="mb-input"
        />
      </label>

      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          {state.error}
        </p>
      )}

      <div className="flex gap-3">
        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </GoldButton>
        <button
          type="button"
          onClick={() => router.push(`/app/${slug}/transactions`)}
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-2 hover:text-gold transition-colors px-4 py-2.5 border border-line hover:border-gold"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
