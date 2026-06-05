import { useActionState, useState, useRef, useEffect } from "react";
import {
  createRecurringRule,
  updateRecurringRule,
  type RecurringState,
} from "@/server/actions/recurring";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";
import Decimal from "decimal.js";

type Account = { id: string; name: string; currency: string };
type Category = { id: string; name: string; kind: "INCOME" | "EXPENSE" };
type Rule = {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: Decimal | string;
  currency: string;
  memo?: string | null;
  freq: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  interval: number;
  startDate: Date;
  endDate?: Date | null;
  finAccountId: string;
  counterAccountId?: string | null;
  categoryId?: string | null;
};

interface Props {
  slug: string;
  accounts: Account[];
  categories: Category[];
  rule?: Rule;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function RecurringRuleForm({
  slug,
  accounts,
  categories,
  rule,
  onSuccess,
  onCancel,
}: Props) {
  const isEdit = !!rule;
  const action = isEdit
    ? updateRecurringRule.bind(null, slug, rule!.id)
    : createRecurringRule.bind(null, slug);

  const [state, formAction, pending] = useActionState<RecurringState, FormData>(
    action,
    {},
  );

  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">(
    rule?.type ?? "EXPENSE",
  );
  const [primaryAcct, setPrimaryAcct] = useState<string>(
    rule?.finAccountId ?? accounts[0]?.id ?? "",
  );
  const [freq, setFreq] = useState<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY">(
    rule?.freq ?? "MONTHLY",
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const startDate = rule?.startDate
    ? new Date(rule.startDate).toISOString().slice(0, 10)
    : today;
  const endDate = rule?.endDate
    ? new Date(rule.endDate).toISOString().slice(0, 10)
    : "";

  const filteredCategories = categories.filter((c) =>
    type === "INCOME" ? c.kind === "INCOME" : c.kind === "EXPENSE",
  );
  const currency = accounts.find((a) => a.id === primaryAcct)?.currency ?? "";

  useEffect(() => {
    if (!pending && state?.success) {
      onSuccess?.();
      if (open) {
        formRef.current?.reset();
        setOpen(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, state]);

  if (!open && !isEdit) {
    return (
      <div className="flex justify-end">
        <GoldButton
          type="button"
          variant="primary"
          onClick={() => setOpen(true)}
        >
          + New rule
        </GoldButton>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <Eyebrow>{isEdit ? "Edit rule" : "New rule"}</Eyebrow>
          {!isEdit && (
            <button
              type="button"
              onClick={() => {
                onCancel?.();
                setOpen(false);
              }}
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold"
            >
              ✕ Close
            </button>
          )}
        </div>

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
              Amount {currency && <span className="text-gold">· {currency}</span>}
            </span>
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              defaultValue={rule?.amount.toString() ?? ""}
              className="mb-input mono"
            />
          </label>

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
        </div>

        {type === "TRANSFER" ? (
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              To account
            </span>
            <select
              name="counterAccountId"
              required
              className="mb-input"
              defaultValue={rule?.counterAccountId ?? accounts[1]?.id ?? ""}
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
              defaultValue={rule?.categoryId ?? ""}
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

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Frequency
            </span>
            <select
              name="freq"
              required
              value={freq}
              onChange={(e) =>
                setFreq(e.target.value as "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY")
              }
              className="mb-input"
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Every N {freq.toLowerCase()}
            </span>
            <input
              name="interval"
              type="number"
              min="1"
              required
              defaultValue={rule?.interval ?? 1}
              className="mb-input mono"
            />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Start date
            </span>
            <input
              type="date"
              name="startDate"
              required
              defaultValue={startDate}
              className="mb-input mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              End date (optional)
            </span>
            <input
              type="date"
              name="endDate"
              defaultValue={endDate}
              className="mb-input mono"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Memo (optional)
          </span>
          <input
            name="memo"
            maxLength={200}
            placeholder="What is this for?"
            defaultValue={rule?.memo ?? ""}
            className="mb-input"
          />
        </label>

        <input type="hidden" name="currency" value={currency} />

        {state?.error && (
          <p className="font-mono text-xs text-[var(--color-down)]">
            {state.error}
          </p>
        )}

        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : isEdit ? "Update rule" : "Create rule"}
        </GoldButton>
      </div>
    </form>
  );
}
