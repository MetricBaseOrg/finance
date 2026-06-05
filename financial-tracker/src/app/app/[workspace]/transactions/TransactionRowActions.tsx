"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { deleteTransaction } from "@/server/actions/transactions";

export function TransactionRowActions({
  slug,
  id,
}: {
  slug: string;
  id: string;
}) {
  const [pending, startTransition] = useTransition();
  const params = useParams();
  const ws = params?.workspace as string | undefined;
  const targetSlug = slug || ws || "";

  return (
    <div className="flex items-center gap-2 justify-end">
      <Link
        href={`/app/${targetSlug}/transactions/${id}/edit`}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={() => {
          if (!confirm("Delete this transaction?")) return;
          startTransition(async () => {
            await deleteTransaction(slug, id);
          });
        }}
        disabled={pending}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-50"
      >
        {pending ? "…" : "Del"}
      </button>
    </div>
  );
}
