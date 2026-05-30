"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveTransaction, rejectTransaction } from "@/server/actions/transactions";

export function ApprovalActions({ slug, id }: { slug: string; id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: typeof approveTransaction) {
    startTransition(async () => {
      const res = await fn(slug, id);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(approveTransaction)}
        className="font-mono rounded-lg text-[10px] uppercase tracking-[0.18em] text-[var(--color-up)] border border-[var(--color-up)] hover:bg-[var(--color-up)] hover:text-black px-3 py-1.5 transition-colors disabled:opacity-50"
      >
        {pending ? "…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(rejectTransaction)}
        className="font-mono rounded-lg text-[10px] uppercase tracking-[0.18em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-50"
      >
        Reject
      </button>
      {error && <span className="font-mono text-[10px] text-[var(--color-down)]">{error}</span>}
    </div>
  );
}
