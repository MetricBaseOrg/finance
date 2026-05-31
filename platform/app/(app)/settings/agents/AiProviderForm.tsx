"use client";

import { useActionState } from "react";
import { saveAiConfig, type AiConfigState } from "@/server/actions/ai-config";
import { GoldButton } from "@/components/mb/GoldButton";
import { Eyebrow } from "@/components/mb/Eyebrow";

export function AiProviderForm({
  slug,
  baseUrl,
  model,
  hasWorkspaceKey,
  source,
}: {
  slug: string;
  baseUrl: string;
  model: string;
  hasWorkspaceKey: boolean;
  source: "workspace" | "env" | "none";
}) {
  const action = saveAiConfig.bind(null, slug);
  const [state, formAction, pending] = useActionState<AiConfigState, FormData>(action, {});

  const keyStatus =
    source === "workspace"
      ? "A workspace key is set."
      : source === "env"
        ? "Using the deployment’s ANTHROPIC_API_KEY (no workspace key set)."
        : "No key set — agents won’t run.";

  return (
    <form action={formAction} className="mb-card p-6 flex flex-col gap-4">
      <div>
        <Eyebrow>AI provider</Eyebrow>
        <p className="text-gray-2 text-sm mt-2 max-w-2xl">
          Point this workspace at any Anthropic-compatible endpoint. Leave fields blank to inherit
          the deployment defaults. The key is encrypted at rest and never shown back.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Base URL (optional)
          </span>
          <input
            name="baseUrl"
            defaultValue={baseUrl}
            placeholder="https://api.anthropic.com"
            className="mb-input font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
            Model (optional)
          </span>
          <input
            name="model"
            defaultValue={model}
            placeholder="claude-sonnet-4-6"
            className="mb-input font-mono"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-gray-3">
          API key {hasWorkspaceKey ? "(leave blank to keep the current key)" : ""}
        </span>
        <input
          name="apiKey"
          type="password"
          placeholder={hasWorkspaceKey ? "•••••••• (unchanged)" : "sk-… or provider key"}
          className="mb-input font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <span className="font-mono text-[10px] text-gray-3">{keyStatus}</span>
      </label>

      {hasWorkspaceKey && (
        <label className="flex items-center gap-2 font-sans text-sm text-gray-2">
          <input type="checkbox" name="clearKey" />
          Remove the workspace key (fall back to the deployment default)
        </label>
      )}

      {state?.error && <p className="font-mono text-xs text-[var(--color-down)]">{state.error}</p>}
      {state?.ok && <p className="font-mono text-xs text-[#3fb950]">Saved.</p>}
      <GoldButton type="submit" variant="primary" disabled={pending}>
        {pending ? "Saving…" : "Save AI settings"}
      </GoldButton>
    </form>
  );
}
