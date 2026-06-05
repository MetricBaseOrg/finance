# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npx prisma generate          # regenerate client after schema changes
npx prisma migrate dev       # apply + create migrations (dev only, uses DIRECT_URL)
npm run prisma:deploy        # apply existing migrations to prod
npm run dev                  # Next.js dev server on :3000
npm run build                # production build (runs tsc via Next — use this to type-check)
npx tsc --noEmit             # type-check without building
npx prisma studio            # browse the DB in a UI
```

`next lint` is broken (no ESLint config). Use `tsc --noEmit` to validate TypeScript.

Restart `npm run dev` after: running migrations, changing `lib/prisma.ts`, or adding env vars (the Prisma client is cached on `globalThis` for HMR and won't pick up schema changes otherwise).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4
- **Prisma 7** + Neon Postgres via `@prisma/adapter-pg` (PgAdapter, not the default engine)
- **Auth.js v5** — JWT sessions; credentials / Google / Microsoft Entra / Resend magic link
- **decimal.js** for all money arithmetic — never use native floats for currency
- Generated Prisma client lives at `app/generated/prisma/client` (non-default output path)
- Brand: `#0a0a0a` bg / `#c9a84c` gold accent / Manrope + JetBrains Mono / sharp corners

## Architecture overview

### Tenancy model

Every piece of data hangs off an `Organization` (workspace). The active org is resolved from the `mb_org` cookie (set by the sidebar switcher) or `/finance/<slug>` URL. Page components call `lib/org.ts`:

- `requireUser()` — asserts an authenticated session or redirects
- `getOrgContext()` — resolves user + all memberships + active org from cookie
- `requireAppAccess(app)` — same, plus redirects to `/access?app=` if not permitted

App access is gated by a 14-day trial (`trialEndsAt` on `Membership`) then explicit per-app grants. Super-admins (env `SUPERADMIN_EMAILS` or DB flag) bypass all gating. Logic lives in `lib/apps.ts`.

### Permission system

`lib/roles.ts` — pure, client-safe: role list (`OWNER/ADMIN/MEMBER/VIEWER`), `Action` type, capability matrix, `can(role, action)` predicate. Import this in client components.

`lib/permissions.ts` — re-exports everything from `lib/roles.ts` plus DB-backed helpers (`getRole`, `validateRoleChange`, `validateMemberRemoval`). Import this in server code.

API routes resolve the acting user's role via `getRole(userId, orgId)` and call `can()` before any mutation.

### Transaction status invariant

`lib/prisma.ts` extends the Prisma client with a query middleware that **automatically injects `status: "POSTED"`** into every `transaction.findMany`, `.aggregate`, `.groupBy`, and `.count` call that doesn't already filter by `status`. This means:

- All totals, reports, and ledger queries transparently exclude pending/rejected entries.
- To query pending transactions explicitly, pass `where: { status: ... }` (any value — you must include the key to opt out of the default).
- `findUnique`/`findFirst` are untouched (needed for approve/edit flows).

MEMBER-created transactions are born `PENDING`; OWNER/ADMIN entries are `POSTED` immediately.

### AI agent runtime

`lib/agent/runtime.ts` — multi-step Anthropic tool-use loop (max 8 steps). An agent is a `User(kind="AGENT")` with a `Membership` (its role = its autonomy). The runtime:

1. Reads `Organization.aiApiKeyEnc` / `aiBaseUrl` / `aiModel` (workspace settings) and falls back to `ANTHROPIC_*` env vars via `lib/anthropic.ts → getOrgAnthropic()`.
2. Runs tools scoped to the agent's `scopes` field, executed as the agent's identity gated by `can()`.
3. Posts results as task comments or chat messages.

Triggers: `@mention`/assignment on task or chat message, "Ask agent" button, or `/api/cron/agent-sweep` backstop. An agent's own actions never trigger another agent (loop guard in `lib/agent/dispatch.ts`).

Needs `ANTHROPIC_API_KEY` (or per-workspace key) and a tool-use-capable model (`Agent.model` overrides the global default).

### Finance ↔ Projects bridge

- A `FinAccount` with `type: "PROJECT"` is bound to one `Project`. Its transactions are auto-attributed; this binding wins over a manual per-transaction project tag (`resolveProjectId`).
- `GET /api/projects/[id]/finance` returns a finance summary card rendered inside the project page.

### Auth split

`auth.config.ts` — edge-safe config (no Prisma, no Node deps), imported by `middleware.ts`. Declares public paths: `/api/auth`, `/api/bot`, `/api/register`, `/api/health`, `/api/cron`, `/invite`, `/auth/*`.

`auth.ts` — full server config with PrismaAdapter and all providers.

### Field analytics proxy

`/api/field/analytics/*` proxies to the Python `field-engine/` Flask service. The web app and engine authenticate with `FIELD_ENGINE_TOKEN`. The engine runs analytics; the web app never computes them directly.

### Cron routes

`POST /api/cron/email-digest`, `/recurring-rollover`, `/agent-sweep` — authenticated with `Bearer CRON_SECRET`. Return `500`/`401` without it. The compose `cron` service calls them on schedule; smoke-test with GET + `?secret=<CRON_SECRET>`.

## Key lib files

| File | Purpose |
|---|---|
| `lib/prisma.ts` | Singleton client with POSTED-status middleware |
| `lib/org.ts` | Session resolution, active-org cookie, app-access guard |
| `lib/roles.ts` | Pure role model + `can()` (client-safe) |
| `lib/permissions.ts` | Re-exports `lib/roles.ts` + DB-backed role helpers |
| `lib/anthropic.ts` | Anthropic client with per-workspace key resolution |
| `lib/agent/runtime.ts` | Multi-step tool-use loop |
| `lib/money.ts` | `d()` Decimal helper + `formatMoney()` |
| `lib/apps.ts` | App IDs, trial model, `canAccessApp()` |
| `lib/email.ts` | Resend wrapper — silent no-op when `RESEND_API_KEY` is absent |

## Companion services

- **`field-engine/`** — Python/Flask analytics for FieldFlow; proxied via `/api/field/analytics/*`
- **`bot/`** — Telegram bot (python-telegram-bot); calls `/api/bot/*` with `BOT_SERVICE_TOKEN`; commands are role-gated by `lib/permissions.ts`
- **`cron/`** — busybox crond container; runs the three cron API routes on schedule

## Environment variables

See `.env.example`. Required for core functionality: `DATABASE_URL` + `DIRECT_URL` (Neon), `AUTH_SECRET`. Optional but needed for features: `ANTHROPIC_API_KEY` (agents/AI), `RESEND_API_KEY` + `EMAIL_FROM` (email), `CRON_SECRET` (cron routes), `TELEGRAM_BOT_TOKEN` + `BOT_SERVICE_TOKEN` (Telegram), `MS_CLIENT_ID` + `MS_CLIENT_SECRET` (OneDrive/Entra auth), `FIELD_ENGINE_TOKEN` (analytics proxy).

`AUTH_URL` and `APP_URL` must match the public HTTPS origin in production. In dev, `trustHost: true` in `auth.config.ts` allows any request host.
