"use client";

import { useState, useTransition } from "react";
import { revokeInvite } from "@/server/actions/members";

export function InviteRowActions({
  slug,
  id,
  token,
}: {
  slug: string;
  id: string;
  token: string;
}) {
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-4 md:justify-end">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(
              `${window.location.origin}/invite/${token}`,
            );
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-gold transition-colors"
      >
        {copied ? "Copied" : "Copy link"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await revokeInvite(slug, id);
          })
        }
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-50"
      >
        {pending ? "…" : "Revoke"}
      </button>
    </div>
  );
}
