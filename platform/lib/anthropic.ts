import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { tryDecryptToken } from '@/lib/crypto'

/**
 * Shared Anthropic client. Provider config resolves per-workspace first
 * (Organization.aiApiKeyEnc / aiBaseUrl / aiModel, set in workspace settings)
 * and falls back to the `ANTHROPIC_*` env vars. The base URL override lets us
 * point at the Xiaomi MiMo proxy (https://api.xiaomimimo.com/anthropic) or any
 * Anthropic-compatible endpoint. Used by the multi-step agent runtime in
 * lib/agent/ and the single-shot helpers in lib/ai.ts.
 */

let _client: Anthropic | null = null

/** Env-only client (no workspace override). */
export function anthropic(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  if (_client) return _client
  _client = new Anthropic({
    apiKey,
    ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
  })
  return _client
}

/** Global default model. Individual agents may override via `Agent.model`. */
export const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL || 'mimo-7b-rl'

export function isAIConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * User-facing message when an org has no usable AI config. AI is configured
 * per-workspace (no platform-wide key), so point the user at the right place
 * instead of implying a server outage.
 */
export const AI_NOT_CONFIGURED_MSG =
  'AI isn’t set up for this workspace yet. An owner or admin can add an AI provider key in Settings → Agents.'

export type ResolvedAi = { apiKey: string; baseUrl?: string; model: string; source: 'workspace' | 'env' }

/** Resolve the effective AI config for an org: workspace settings over env. */
export async function resolveAi(organizationId?: string | null): Promise<ResolvedAi | null> {
  let orgKey: string | null = null
  let orgBaseUrl: string | null = null
  let orgModel: string | null = null
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { aiApiKeyEnc: true, aiBaseUrl: true, aiModel: true },
    })
    orgKey = tryDecryptToken(org?.aiApiKeyEnc)
    orgBaseUrl = org?.aiBaseUrl ?? null
    orgModel = org?.aiModel ?? null
  }
  const apiKey = orgKey || process.env.ANTHROPIC_API_KEY
  if (!apiKey) return null
  return {
    apiKey,
    baseUrl: orgBaseUrl || process.env.ANTHROPIC_BASE_URL || undefined,
    model: orgModel || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
    source: orgKey ? 'workspace' : 'env',
  }
}

/** Build an Anthropic client + default model for an org (workspace config or env). */
export async function getOrgAnthropic(organizationId?: string | null): Promise<{ client: Anthropic; model: string } | null> {
  const r = await resolveAi(organizationId)
  if (!r) return null
  return {
    client: new Anthropic({ apiKey: r.apiKey, ...(r.baseUrl && { baseURL: r.baseUrl }) }),
    model: r.model,
  }
}

/** Whether AI is usable for an org (workspace key or env key present). */
export async function isOrgAIConfigured(organizationId?: string | null): Promise<boolean> {
  return Boolean(await resolveAi(organizationId))
}
