"use client";

import { useTransition } from "react";
import { archiveAccount, unarchiveAccount } from "@/server/actions/accounts";
import { AccountEditDialog } from "./AccountEditDialog";
import type { FinAccountType } from "@prisma/client";

type Props = {
  slug: string;
  id: string;
  archived: boolean;
  name: string;
  type: FinAccountType;
  currency: string;
  openingBalance: string;
};

export function AccountRowActions({
  slug,
  id,
  archived,
  name,
  type,
  currency,
  openingBalance,
}: Props) {
  const [pending, startTransition] = useTransition();

  function onArchiveToggle() {
    startTransition(async () => {
      if (archived) {
        await unarchiveAccount(slug, id);
      } else {
        await archiveAccount(slug, id);
      }
    });
  }

  return (
    <div className="flex items-center justify-end gap-4">
      {!archived && (
        <AccountEditDialog
          slug={slug}
          account={{ id, name, type, currency, openingBalance }}
        />
      )}
      <button
        type="button"
        onClick={onArchiveToggle}
        disabled={pending}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors disabled:opacity-50"
      >
        {pending ? "…" : archived ? "Unarchive" : "Archive"}
      </button>
    </div>
  );
}
