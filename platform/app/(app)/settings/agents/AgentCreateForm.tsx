"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAgent, type AgentActionState } from "@/server/actions/agents";
import { AGENT_SCOPES } from "@/lib/schemas";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

const ROLES = ["ADMIN", "MEMBER", "VIEWER"] as const;

const SCOPE_LABELS: Record<(typeof AGENT_SCOPES)[number], string> = {
  tasks: "Tasks & projects",
  finance: "Finance (read)",
  field: "Field (read)",
  chat: "Team chat",
  search: "Search",
};

export function AgentCreateForm({ slug }: { slug: string }) {
  const action = createAgent.bind(null, slug);
  const [state, formAction, pending] = useActionState<AgentActionState, FormData>(action, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state?.ok) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={formAction} className="mb-card p-6 flex flex-col gap-4">
      <Eyebrow>New agent</Eyebrow>
      <div className="grid grid-cols-1 sm:grid-cols-[1.6fr_140px] gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Name (mention it as @name)
          </span>
          <input name="name" placeholder="PM Bot" className="mb-input" autoComplete="off" required />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Role
          </span>
          <select name="role" defaultValue="ADMIN" className="mb-input">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Model (optional — falls back to the workspace default)
          </span>
          <input name="model" placeholder="claude-sonnet-4-6" className="mb-input" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Avatar — image URL or drive share link (optional)
          </span>
          <input name="avatarUrl" placeholder="https://…" className="mb-input" autoComplete="off" />
        </label>
      </div>

      <fieldset className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Scopes (what the agent can touch)
        </span>
        <div className="flex flex-wrap gap-4">
          {AGENT_SCOPES.map((s) => (
            <label key={s} className="flex items-center gap-2 font-sans text-sm text-white">
              <input type="checkbox" name="scopes" value={s} defaultChecked={s === "tasks" || s === "chat"} />
              {SCOPE_LABELS[s]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          Instructions / persona
        </span>
        <textarea
          name="instructions"
          rows={4}
          placeholder="You help triage incoming tasks. Break large tasks into subtasks, keep statuses current, and summarize threads on request. Be concise."
          className="mb-input font-sans"
        />
      </label>

      {state?.error && (
        <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>
      )}
      <GoldButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Creating…" : "Create agent"}
      </GoldButton>
    </form>
  );
}
