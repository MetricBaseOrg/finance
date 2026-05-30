"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { updateAgent, deleteAgent, type AgentActionState } from "@/server/actions/agents";
import { AGENT_SCOPES } from "@/lib/schemas";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;
const SCOPE_LABELS: Record<string, string> = {
  tasks: "Tasks",
  finance: "Finance",
  field: "Field",
  chat: "Chat",
};

export function AgentRowActions({
  slug,
  agent,
}: {
  slug: string;
  agent: {
    id: string;
    name: string;
    role: string;
    model: string | null;
    image: string | null;
    instructions: string;
    scopes: string[];
    enabled: boolean;
  };
}) {
  const action = updateAgent.bind(null, slug);
  const [state, formAction, pending] = useActionState<AgentActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, startDelete] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!pending && state?.ok) setEditing(false);
  }, [pending, state]);

  return (
    <div className="flex flex-col gap-3 md:items-end">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="font-mono rounded-lg text-[10px] uppercase tracking-[0.2em] text-gold hover:text-gold-bright transition-colors"
        >
          {editing ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={() => {
            if (!confirm(`Delete agent "${agent.name}"? This removes its account and history.`)) return;
            startDelete(async () => {
              const res = await deleteAgent(slug, agent.id);
              setDeleteError(res?.error ?? null);
            });
          }}
          className="font-mono rounded-lg text-[10px] uppercase tracking-[0.2em] text-gray-3 hover:text-[var(--color-down)] transition-colors disabled:opacity-40"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>
      {deleteError && (
        <span className="font-mono text-[10px] text-[var(--color-down)]">{deleteError}</span>
      )}

      {editing && (
        <form
          ref={formRef}
          action={formAction}
          className="mb-card p-4 flex flex-col gap-3 w-full md:w-[420px] mt-1"
        >
          <input type="hidden" name="agentId" value={agent.id} />
          <div className="grid grid-cols-[1.6fr_120px] gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">Name</span>
              <input name="name" defaultValue={agent.name} className="mb-input" required />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">Role</span>
              <select name="role" defaultValue={agent.role} className="mb-input">
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">Model (optional)</span>
            <input name="model" defaultValue={agent.model ?? ""} className="mb-input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">Avatar URL or drive share link (optional)</span>
            <input name="avatarUrl" defaultValue={agent.image ?? ""} className="mb-input" />
          </label>
          <fieldset className="flex flex-wrap gap-3">
            {AGENT_SCOPES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 font-sans text-xs text-white">
                <input type="checkbox" name="scopes" value={s} defaultChecked={agent.scopes.includes(s)} />
                {SCOPE_LABELS[s]}
              </label>
            ))}
          </fieldset>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">Instructions</span>
            <textarea name="instructions" defaultValue={agent.instructions} rows={4} className="mb-input font-sans" />
          </label>
          <label className="flex items-center gap-2 font-sans text-sm text-white">
            <input type="checkbox" name="enabled" value="true" defaultChecked={agent.enabled} />
            Enabled
          </label>
          {state?.error && (
            <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="font-mono rounded-lg text-[11px] uppercase tracking-[0.18em] text-gold border border-gold hover:bg-gold hover:text-black px-4 py-2.5 transition-colors disabled:opacity-50 self-start"
          >
            {pending ? "Saving…" : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
