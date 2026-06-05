import { useActionState, useState, useRef, useEffect } from "react";
import {
  recordTrade,
  type InvestmentState,
} from "@/server/actions/investments";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

type Account = { id: string; name: string; currency: string; type: string };

export function TradeForm({
  slug,
  accounts,
}: {
  slug: string;
  accounts: Account[];
}) {
  const brokerageAccounts = accounts.filter((a) =>
    ["BROKERAGE", "CRYPTO"].includes(a.type),
  );
  const action = recordTrade.bind(null, slug);
  const [state, formAction, pending] = useActionState<InvestmentState, FormData>(
    action,
    {},
  );

  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [unitKind, setUnitKind] = useState<"SHARES" | "TOKENS" | "LOTS">("SHARES");
  const [selectedAcct, setSelectedAcct] = useState<string>(
    brokerageAccounts[0]?.id ?? "",
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const currency = accounts.find((a) => a.id === selectedAcct)?.currency ?? "";

  useEffect(() => {
    if (!pending && !state?.error && state !== undefined) {
      if (open) {
        formRef.current?.reset();
        setOpen(false);
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
          + Record trade
        </GoldButton>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6">
      <div className="flex flex-col gap-5">
        <div className="flex justify-between items-center">
          <Eyebrow>Record trade</Eyebrow>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold"
          >
            ✕ Close
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(["BUY", "SELL"] as const).map((s) => (
            <label
              key={s}
              className={`border p-3 cursor-pointer text-center transition-colors font-mono text-xs uppercase tracking-[0.18em] ${
                side === s
                  ? "border-gold text-gold bg-[rgba(201,168,76,0.06)]"
                  : "border-line text-gray-2 hover:border-gold/50"
              }`}
            >
              <input
                type="radio"
                name="side"
                value={s}
                checked={side === s}
                onChange={() => setSide(s)}
                className="sr-only"
              />
              {s}
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Symbol
            </span>
            <input
              name="symbol"
              type="text"
              required
              placeholder="AAPL"
              maxLength={20}
              className="mb-input mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Account
            </span>
            <select
              name="finAccountId"
              required
              value={selectedAcct}
              onChange={(e) => setSelectedAcct(e.target.value)}
              className="mb-input"
            >
              {brokerageAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(["SHARES", "TOKENS", "LOTS"] as const).map((u) => (
            <label
              key={u}
              className={`border p-3 cursor-pointer text-center transition-colors font-mono text-xs uppercase tracking-[0.18em] ${
                unitKind === u
                  ? "border-gold text-gold bg-[rgba(201,168,76,0.06)]"
                  : "border-line text-gray-2 hover:border-gold/50"
              }`}
            >
              <input
                type="radio"
                name="unitKind"
                value={u}
                checked={unitKind === u}
                onChange={() => setUnitKind(u)}
                className="sr-only"
              />
              {u}
            </label>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Quantity
            </span>
            <input
              name="quantity"
              type="number"
              step="0.00000001"
              min="0.00000001"
              required
              placeholder="0.00"
              className="mb-input mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Unit price {currency && <span className="text-gold">· {currency}</span>}
            </span>
            <input
              name="unitPrice"
              type="number"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              className="mb-input mono"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
              Fee (optional)
            </span>
            <input
              name="fee"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              className="mb-input mono"
            />
          </label>
        </div>

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

        {state?.error && (
          <p className="font-mono text-xs text-[var(--color-down)]">
            {state.error}
          </p>
        )}

        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Recording…" : "Record trade"}
        </GoldButton>
      </div>
    </form>
  );
}
