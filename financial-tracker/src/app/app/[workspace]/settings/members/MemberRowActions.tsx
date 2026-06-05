"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import type { Role } from "@prisma/client";
import {
  changeMemberRole,
  removeMember,
  type MemberActionState,
} from "@/server/actions/members";

const ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export function MemberRowActions({
  slug,
  membershipId,
  role,
  locked,
}: {
  slug: string;
  membershipId: string;
  role: Role;
  locked: boolean;
}) {
  const action = changeMemberRole.bind(null, slug);
  const [state, formAction] = useActionState<MemberActionState, FormData>(
    action,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [removeError, setRemoveError] = useState<string | null>(null);

  const error = state?.error ?? removeError;

  return (
    <div className="flex items-center gap-4 md:justify-end">
      <form ref={formRef} action={formAction} className="flex items-center gap-2">
        <input type="hidden" name="membershipId" value={membershipId} />
        <select
          name="role"
          defaultValue={role}
          disabled={locked}
          onChange={() => formRef.current?.requestSubmit()}
          className="mb-input text-xs py-1.5 disabled:opacity-50"
          aria-label="Role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </form>
      <button
        type="button"
        disabled={locked || pending}
        onClick={() => {
          if (!confirm("Remove this member from the workspace?")) return;
          startTransition(async () => {
            const res = await removeMember(slug, membershipId);
            setRemoveError(res?.error ?? null);
          });
        }}
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-40"
      >
        {pending ? "…" : "Remove"}
      </button>
      {error && (
        <span className="font-mono text-[10px] text-[var(--color-down)]">
          {error}
        </span>
      )}
    </div>
  );
}
