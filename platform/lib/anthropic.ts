import Anthropic from '@anthropic-ai/sdk'

/**
 * Shared Anthropic client. The base URL is overrideable via `ANTHROPIC_BASE_URL`
 * so we can point at the Xiaomi MiMo proxy (https://api.xiaomimimo.com/anthropic)
 * instead of the official endpoint. Used by both the single-shot helpers in
 * lib/ai.ts and the multi-step agent runtime in lib/agent/.
 */

let _client: Anthropic | null = null

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
