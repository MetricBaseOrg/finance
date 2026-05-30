import 'server-only'

// Server-side client for the Python field compute engine (analytics, metrics,
// formula DSL) which reads the shared Postgres read-only. Next.js owns auth +
// the schema; it forwards compute requests with the org id and a shared token.

const BASE = process.env.FIELD_ENGINE_BASE || 'http://field-engine:5001'
const TOKEN = process.env.FIELD_ENGINE_TOKEN || ''

export type EngineResult = {
  ok: boolean
  data?: unknown
  status?: number
  error?: string
}

async function call(
  method: 'GET' | 'POST',
  path: string,
  organizationId: string,
  opts: { query?: Record<string, string>; body?: unknown } = {},
): Promise<EngineResult> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('company_id', organizationId)
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v != null && v !== '') url.searchParams.set(k, v)
  }

  try {
    const res = await fetch(url.toString(), {
      method,
      headers: {
        'X-Engine-Token': TOKEN,
        ...(opts.body ? { 'content-type': 'application/json' } : {}),
      },
      ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
      // Fail fast when the engine is unreachable so the UI can show the
      // offline state quickly; real compute calls still get a few seconds.
      signal: AbortSignal.timeout(6_000),
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { ok: false, status: res.status, error: (data as { error?: string })?.error || `Engine error ${res.status}` }
    }
    return { ok: true, data }
  } catch {
    // Engine unreachable (not deployed yet, or down). Callers degrade gracefully.
    return { ok: false, status: 503, error: 'Field compute engine is unavailable' }
  }
}

export const fieldEngine = {
  analytics(organizationId: string, path: string, query?: Record<string, string>) {
    const clean = path.replace(/^\/+/, '')
    return call('GET', `/compute/analytics/${clean}`, organizationId, { query })
  },
  evalFormula(organizationId: string, body: unknown) {
    return call('POST', '/compute/formula/eval', organizationId, { body })
  },
  dashboard(organizationId: string, body: unknown) {
    return call('POST', '/compute/dashboard', organizationId, { body })
  },
}
