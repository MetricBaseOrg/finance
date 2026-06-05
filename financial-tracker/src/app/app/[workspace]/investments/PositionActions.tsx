"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  recordBuy,
  recordSell,
  recordDividend,
  updatePositionPrice,
  closePosition,
  type InvestmentActionState,
} from "@/server/actions/investments";
import { GoldButton } from "@/components/mb/GoldButton";

type BoundAction = (
  prev: InvestmentActionState | undefined,
  formData: FormData,
) => Promise<InvestmentActionState>;

function ActionDialog({
  label,
  title,
  action,
  children,
}: {
  label: string;
  title: string;
  action: BoundAction;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<
    InvestmentActionState,
    FormData
  >(action, {});

  const submitted = useRef(false);
  useEffect(() => {
    if (pending) submitted.current = true;
    if (!pending && submitted.current && state && !state.error) {
      submitted.current = false;
      dialogRef.current?.close();
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors"
      >
        {label}
      </button>
      <dialog
        ref={dialogRef}
        className="bg-[var(--color-bg-elev)] border border-line text-gray-1 p-0 w-full max-w-md m-auto backdrop:bg-black/70 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current.close();
        }}
      >
        <form ref={formRef} action={formAction} className="flex flex-col gap-5 p-6">
          <h2 className="font-sans text-base font-bold text-white">{title}</h2>
          {children}
          {state?.error && (
            <p className="font-mono text-xs text-[var(--color-down)]">
              {state.error}
            </p>
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
              {pending ? "Saving…" : "Confirm"}
            </GoldButton>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
        {label}
      </span>
      {children}
    </label>
  );
}

export function PositionActions({
  slug,
  positionId,
  currency,
  closed,
}: {
  slug: string;
  positionId: string;
  currency: string;
  closed: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [pendingClose, startClose] = useTransition();
  const [closeErr, setCloseErr] = useState<string | null>(null);

  if (closed) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
        Closed
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4">
      <ActionDialog
        label="Buy"
        title="Record buy"
        action={recordBuy.bind(null, slug)}
      >
        <input type="hidden" name="positionId" value={positionId} />
        <Field label={`Quantity`}>
          <input name="quantity" type="number" step="any" required className="mb-input mono" />
        </Field>
        <Field label={`Cost per unit (${currency})`}>
          <input name="costPerUnit" type="number" step="any" required className="mb-input mono" />
        </Field>
        <Field label={`Fees (${currency}, optional)`}>
          <input name="fees" type="number" step="any" className="mb-input mono" />
        </Field>
        <Field label="Acquired at">
          <input name="acquiredAt" type="date" defaultValue={today} required className="mb-input mono" />
        </Field>
      </ActionDialog>

      <ActionDialog
        label="Sell"
        title="Record sell (FIFO)"
        action={recordSell.bind(null, slug)}
      >
        <input type="hidden" name="positionId" value={positionId} />
        <Field label="Quantity">
          <input name="quantity" type="number" step="any" required className="mb-input mono" />
        </Field>
        <Field label={`Price per unit (${currency})`}>
          <input name="pricePerUnit" type="number" step="any" required className="mb-input mono" />
        </Field>
        <Field label={`Fees (${currency}, optional)`}>
          <input name="fees" type="number" step="any" className="mb-input mono" />
        </Field>
        <Field label="Sold at">
          <input name="soldAt" type="date" defaultValue={today} required className="mb-input mono" />
        </Field>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            name="postTransaction"
            value="on"
            defaultChecked
            className="accent-[var(--color-gold)]"
          />
          <span className="font-mono text-[11px] text-gray-2">
            Post net proceeds to the ledger
          </span>
        </label>
      </ActionDialog>

      <ActionDialog
        label="Dividend"
        title="Record dividend"
        action={recordDividend.bind(null, slug)}
      >
        <input type="hidden" name="positionId" value={positionId} />
        <Field label={`Total amount (${currency})`}>
          <input name="totalAmount" type="number" step="any" required className="mb-input mono" />
        </Field>
        <Field label="Pay date">
          <input name="payDate" type="date" defaultValue={today} required className="mb-input mono" />
        </Field>
      </ActionDialog>

      <ActionDialog
        label="Price"
        title="Update market price"
        action={updatePositionPrice.bind(null, slug)}
      >
        <input type="hidden" name="positionId" value={positionId} />
        <Field label={`Current price per unit (${currency})`}>
          <input name="lastPrice" type="number" step="any" required className="mb-input mono" />
        </Field>
      </ActionDialog>

      <button
        type="button"
        disabled={pendingClose}
        onClick={() => {
          if (!confirm("Close this position? All holdings must be sold.")) return;
          startClose(async () => {
            const res = await closePosition(slug, positionId);
            setCloseErr(res?.error ?? null);
          });
        }}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-50"
      >
        {pendingClose ? "…" : "Close"}
      </button>
      {closeErr && (
        <span className="font-mono text-[10px] text-[var(--color-down)]">
          {closeErr}
        </span>
      )}
    </div>
  );
}
