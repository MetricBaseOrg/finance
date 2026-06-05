"use client";

import { useState, useTransition } from "react";
import { Money } from "@/components/mb/Money";
import { GoldButton } from "@/components/mb/GoldButton";
import { updateAccount, archiveAccount, unarchiveAccount } from "@/server/actions/accounts";

const TYPES = ["BANK", "CASH", "CRYPTO", "BROKERAGE", "CREDIT", "OTHER"] as const;
const CURRENCIES = ["IDR", "USD", "EUR", "SGD", "MYR", "BTC", "ETH"] as const;

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  openingBalance: { toString(): string };
  archivedAt: Date | null;
};

export function AccountRow({ account, slug }: { account: Account; slug: string }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const archived = !!account.archivedAt;

  function handleArchive() {
    startTransition(async () => {
      if (archived) await unarchiveAccount(slug, account.id);
      else await archiveAccount(slug, account.id);
    });
  }

  function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("id", account.id);
    startTransition(async () => {
      await updateAccount(slug, undefined, fd);
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <>
        {/* Desktop edit row */}
        <form
          onSubmit={handleUpdate}
          className="hidden md:grid grid-cols-[1fr_120px_120px_160px_120px] px-4 py-2 items-end gap-2 border-b border-line bg-[var(--color-bg-hover)]"
        >
          <input name="name" defaultValue={account.name} required maxLength={60} className="mb-input text-sm py-1.5" />
          <select name="type" defaultValue={account.type} className="mb-input text-sm py-1.5">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select name="currency" defaultValue={account.currency} className="mb-input text-sm py-1.5">
            {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input name="openingBalance" type="number" step="0.01" defaultValue={account.openingBalance.toString()} className="mb-input mono text-sm py-1.5" />
          <div className="flex gap-2">
            <GoldButton type="submit" variant="primary" disabled={pending} className="text-[10px] px-3 py-1.5">
              {pending ? "…" : "Save"}
            </GoldButton>
            <button type="button" onClick={() => setEditing(false)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 hover:text-gold transition-colors">
              Cancel
            </button>
          </div>
        </form>
        {/* Mobile edit card */}
        <form onSubmit={handleUpdate} className="md:hidden px-4 py-4 border-b border-line bg-[var(--color-bg-hover)] flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="label-mono">Name</span>
            <input name="name" defaultValue={account.name} required maxLength={60} className="mb-input" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="label-mono">Type</span>
              <select name="type" defaultValue={account.type} className="mb-input">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="label-mono">Currency</span>
              <select name="currency" defaultValue={account.currency} className="mb-input">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="label-mono">Opening balance</span>
            <input name="openingBalance" type="number" step="0.01" defaultValue={account.openingBalance.toString()} className="mb-input mono" />
          </label>
          <div className="flex gap-3">
            <GoldButton type="submit" variant="primary" disabled={pending}>{pending ? "Saving…" : "Save"}</GoldButton>
            <button type="button" onClick={() => setEditing(false)} className="font-mono text-[11px] uppercase tracking-[0.18em] text-gray-3 hover:text-gold transition-colors">Cancel</button>
          </div>
        </form>
      </>
    );
  }

  return (
    <div className={`border-b border-line last:border-b-0 transition-colors ${archived ? "" : "hover:bg-[var(--color-bg-hover)]"}`}>
      {/* Desktop row */}
      <div className="hidden md:grid grid-cols-[1fr_120px_120px_160px_120px] px-4 py-3 items-center">
        <span className={`font-sans ${archived ? "text-gray-2" : "text-white"}`}>{account.name}</span>
        <span className={`font-mono text-xs ${archived ? "text-gray-3" : "text-gray-2"}`}>{account.type}</span>
        <span className={`font-mono text-xs ${archived ? "text-gray-3" : "text-gold"}`}>{account.currency}</span>
        <Money value={account.openingBalance.toString()} currency={account.currency} className={archived ? "text-gray-3" : "text-white"} />
        <div className="flex gap-3 justify-end">
          {!archived && (
            <button type="button" onClick={() => setEditing(true)} className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors">
              Edit
            </button>
          )}
          <button type="button" onClick={handleArchive} disabled={pending} className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors disabled:opacity-50">
            {pending ? "…" : archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>
      {/* Mobile card */}
      <div className="md:hidden px-4 py-4 flex flex-col gap-2">
        <div className="flex justify-between items-start gap-3">
          <div className="flex flex-col min-w-0">
            <span className={`font-sans font-semibold truncate ${archived ? "text-gray-2" : "text-white"}`}>{account.name}</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-3 mt-1">
              {account.type} · <span className={archived ? "text-gray-3" : "text-gold"}>{account.currency}</span>
            </span>
          </div>
          <Money value={account.openingBalance.toString()} currency={account.currency} className={`text-base font-bold shrink-0 ${archived ? "text-gray-3" : "text-white"}`} />
        </div>
        <div className="flex gap-4 justify-end pt-1">
          {!archived && (
            <button type="button" onClick={() => setEditing(true)} className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors">Edit</button>
          )}
          <button type="button" onClick={handleArchive} disabled={pending} className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors disabled:opacity-50">
            {pending ? "…" : archived ? "Unarchive" : "Archive"}
          </button>
        </div>
      </div>
    </div>
  );
}
