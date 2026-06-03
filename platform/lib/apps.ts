// Single source of truth for the platform's gateable apps and the trial-aware
// access model.
//
// A membership unlocks every app for a 14-day trial (`trialEndsAt`). Once the
// trial expires, only the apps a super-admin has explicitly granted (the
// `appAccess` allow-list) are accessible — an empty list then means no apps.
// Super-admins are always unrestricted. The Workspace/Home surface is always
// accessible and is therefore not listed here.

export const APP_IDS = ['projects', 'finance', 'field', 'tools', 'chat'] as const
export type AppAccessId = (typeof APP_IDS)[number]

/** Length of the all-apps trial granted to every new membership. */
export const TRIAL_DAYS = 14
export function trialEndsFromNow(): Date {
  return new Date(Date.now() + TRIAL_DAYS * 86_400_000)
}

export function isAppId(s: unknown): s is AppAccessId {
  return typeof s === 'string' && (APP_IDS as readonly string[]).includes(s)
}

export type AppMeta = {
  /** Display name in the app switcher. */
  name: string
  /** Short mono caption under the name. */
  sub: string
  /** Landing route for the app. */
  href: string
  /** Path prefixes that belong to this app (for route → app resolution + guards). */
  prefixes: string[]
}

export const APP_META: Record<AppAccessId, AppMeta> = {
  projects: { name: 'ProBase', sub: 'Projects', href: '/projects', prefixes: ['/projects'] },
  finance:  { name: 'Finance', sub: 'Tracker', href: '/finance', prefixes: ['/finance'] },
  field:    { name: 'FieldFlow', sub: 'Field ops', href: '/field', prefixes: ['/field'] },
  tools:    { name: 'OGtools', sub: 'Calculators', href: '/tools', prefixes: ['/tools'] },
  chat:     { name: 'Chat', sub: 'Team', href: '/chat', prefixes: ['/chat'] },
}

export type AccessCtx = {
  /** Explicit per-app grants on the membership. */
  appAccess: string[]
  /** Trial expiry (Date, ISO string, or null). */
  trialEndsAt: string | Date | null
  /** Platform super-admins bypass all gating. */
  isSuperAdmin: boolean
}

export type TrialState = {
  /** True while the trial is still active. */
  onTrial: boolean
  /** Whole days left in the trial (0 once expired). */
  daysLeft: number
  endsAt: Date | null
}

/** Resolve a membership's trial window. */
export function trialState(trialEndsAt: string | Date | null): TrialState {
  if (!trialEndsAt) return { onTrial: false, daysLeft: 0, endsAt: null }
  const endsAt = new Date(trialEndsAt)
  const ms = endsAt.getTime() - Date.now()
  return { onTrial: ms > 0, daysLeft: Math.max(0, Math.ceil(ms / 86_400_000)), endsAt }
}

/**
 * Can this membership open the given app right now?
 * super-admin → yes; on trial → yes; otherwise only explicitly granted apps
 * (an empty `appAccess` then means no apps).
 */
export function canAccessApp(app: AppAccessId, ctx: AccessCtx): boolean {
  if (ctx.isSuperAdmin) return true
  if (trialState(ctx.trialEndsAt).onTrial) return true
  return ctx.appAccess.includes(app)
}

/** Every app currently accessible to this membership. */
export function accessibleApps(ctx: AccessCtx): AppAccessId[] {
  return APP_IDS.filter((a) => canAccessApp(a, ctx))
}

/** Resolve a pathname to the app it belongs to, or null for Workspace/Home. */
export function appForPath(pathname: string): AppAccessId | null {
  for (const id of APP_IDS) {
    if (APP_META[id].prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
      return id
    }
  }
  return null
}
