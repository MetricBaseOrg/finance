"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptInviteState } from "@/server/actions/invite-accept";
import { GoldButton } from "@/components/mb/GoldButton";

export function AcceptInviteForm({ token }: { token: string }) {
  const action = acceptInvite.bind(null, token);
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    action,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">
          {state.error}
        </p>
      )}
      <GoldButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Joining…" : "Accept invite"}
      </GoldButton>
    </form>
  );
}
