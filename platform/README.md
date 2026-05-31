# MetricBase Platform

The unified, authenticated MetricBase workspace — one app hosting **Projects**, **Finance**, **Field operations**, **Team chat**, and **AI agents**, all scoped to a shared **Organization** (workspace). Deploys at `apps.metricbase.org`.

> This supersedes the standalone `financial-tracker` app: finance is now one module inside the platform, alongside projects (ProBase) and field ops (FieldFlow).

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind v4
- **Prisma 7** + **Neon Postgres** (via `@prisma/adapter-pg`)
- **Auth.js v5** — Credentials, Google, Microsoft Entra, Resend magic link
- **decimal.js** for all money arithmetic
- Brand: `#0a0a0a` / `#c9a84c` gold / Manrope + JetBrains Mono / sharp corners

## Tenancy & roles

- **Organization** is the tenant hub; every module row hangs off `organizationId`. The active org is resolved from the `mb_org` cookie (sidebar switcher) or the `/finance/<slug>` URL.
- **Membership** links a `User` to an Organization with a **Role**: `OWNER` · `ADMIN` · `MEMBER` · `VIEWER`. `lib/permissions.ts` is the source of truth (`can(role, action)`).
- `User.kind` is `HUMAN` or `AGENT` (see Agents). Agent users can't sign in.

## Modules

| Route | Module | Notes |
| --- | --- | --- |
| `/home` | Workspace home | org switcher, app launcher |
| `/projects` | **Projects** (ProBase) | tasks, kanban/list/calendar/timeline/S-curve, milestones, dependencies, comments, AI breakdown/summarize, templates |
| `/finance/<slug>` | **Finance** | accounts, transactions, budgets, recurring, investments, reports (P&L + balance sheet), **Projects** sub-tab, CSV/PDF export |
| `/field` | **FieldFlow** | nodes, flow log, transfers, liftings, targets, formulas, analytics, **reports**, **data** (import/export), **audit**. Analytics computed by the Python `field-engine` service |
| `/chat` | **Team chat** | polling-based channels; humans + agents as members; `@mention` an agent and it replies |
| `/settings`, `/settings/agents`, `/u/[id]` | Account | profile editing, AI agent management, public profiles |

## Key cross-cutting features

### Projects ↔ Finance
- **`PROJECT` account type**: a `FinAccount` bound to one `Project`. Its transactions are auto-attributed to that project. Created/edited by OWNER/ADMIN only.
- **Per-transaction project tag**: any transaction can also be tagged with a project (create/edit/CSV import + ledger filter). A PROJECT account's binding wins over the manual tag (`resolveProjectId`).
- **Finance Projects views**: per-project P&L/summary, budget-vs-actual (`Project.budget`), projects overview. A finance summary card also appears on the project page in `/projects` via `GET /api/projects/[id]/finance`.

### Transaction approval workflow
- Account management (create/edit/archive) is **OWNER/ADMIN only**.
- A **MEMBER**'s transaction (manual or CSV import) is created `PENDING`; OWNER/ADMIN entries are `POSTED` immediately. VIEWERs can't record.
- OWNER/ADMIN **approve/reject** from the pending queue on the ledger.
- **Only `POSTED` transactions count** in any total. This is enforced centrally by a Prisma client extension in `lib/prisma.ts` that injects `status: 'POSTED'` into transaction `findMany`/`aggregate`/`groupBy`/`count` unless the caller sets `status` explicitly (ledger, pending queue) — `findFirst`/`findUnique` are untouched so approve/edit can see pending.
- **Notifications**: approvers are alerted (in-app + email) when a member submits; the submitter is alerted when their entry is approved/rejected. Email is a no-op without `RESEND_API_KEY`; in-app always works.

### AI agents
- An agent = a `User(kind="AGENT")` + a `Membership` (its role = its autonomy), configured at `/settings/agents` (name, role, scopes, instructions, optional model).
- Runtime (`lib/agent/`) runs a multi-step Anthropic tool-use loop; tools (tasks, chat, finance/field read) execute as the agent's identity, gated by `can()`.
- Triggers: `@mention`/assignment on a task or chat, an on-demand "Ask agent" button, and a `/api/cron/agent-sweep` backstop. Loop guard: an agent's own actions never trigger another agent.
- Needs `ANTHROPIC_API_KEY` and a **tool-use-capable model** (set a per-agent model override if the global one can't run tool loops).

## Local development

```bash
npm install
npx prisma generate
npx prisma migrate dev      # apply migrations to the DB in .env.local
npm run dev                 # http://localhost:3000
npm run build               # production build (type-checks all routes)
```

Restart `npm run dev` after migrations or changes to `lib/prisma.ts` (the client is cached on `globalThis` for HMR).

## Environment

See [`.env.example`](./.env.example). Key vars: `DATABASE_URL` / `DIRECT_URL` (Neon), `AUTH_SECRET` + provider creds, `AUTH_RESEND_KEY` (email), `ANTHROPIC_*` (agents), `CRON_SECRET` (cron routes), `MS_*` + `FIELD_ENGINE_*` (OneDrive + field engine).

## Companion services

- **`field-engine/`** — Python (Flask) analytics service for the Field module; the Next app proxies to it via `/api/field/analytics/*`.
- **`bot/`** — Telegram bot worker skeleton.
- **`docker-compose.yml`** — web + bot + field-engine + Caddy.

## Cron routes (Bearer `CRON_SECRET`)

- `POST /api/cron/email-digest` — daily notification digest
- `POST /api/cron/recurring-rollover` — spawn overdue recurring tasks
- `POST /api/cron/agent-sweep` — backstop dispatch for agent-directed work
