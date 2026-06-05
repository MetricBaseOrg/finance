"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createInvite, type InviteActionState } from "@/server/actions/members";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

const ROLES = ["MEMBER", "ADMIN", "VIEWER"] as const;

export function InviteCreateForm({ slug }: { slug: string }) {
  const action = createInvite.bind(null, slug);
  const [state, formAction, pending] = useActionState<InviteActionState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!pending && state?.token) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  const copied = !!state?.token && copiedToken === state.token;

  const link =
    state?.token && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${state.token}`
      : null;

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6 flex flex-col gap-4">
      <Eyebrow>New invite</Eyebrow>
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_140px_160px] gap-3 items-end">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Email (optional — locks the invite to that address)
          </span>
          <input
            type="email"
            name="email"
            placeholder="teammate@company.com"
            className="mb-input"
            autoComplete="off"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Role
          </span>
          <select name="role" defaultValue="MEMBER" className="mb-input">
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <GoldButton type="submit" variant="primary" disabled={pending}>
          {pending ? "Creating…" : "Create invite"}
        </GoldButton>
      </div>
      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>
      )}
      {link && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            One-time invite link — copy and share it now
          </span>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.currentTarget.select()}
              className="mb-input mono text-xs flex-1"
            />
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopiedToken(state?.token ?? null);
                } catch {
                  setCopiedToken(null);
                }
              }}
              className="font-mono text-[11px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-4 py-2.5 transition-colors"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
