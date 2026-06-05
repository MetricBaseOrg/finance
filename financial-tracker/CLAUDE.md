# financial-tracker — Claude Code guide

> **Next.js 16 has breaking changes** from prior versions — APIs, conventions, and file structure may all differ from training data. Read `node_modules/next/dist/docs/` for any unfamiliar API before writing code. See also `AGENTS.md`.

Multi-tenant financial tracker for individuals and companies. Deployed to `apps.metricbase.org`.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 16.2.6 — App Router, TypeScript, Tailwind v4 |
| Database | Neon Postgres (pooled via `@prisma/adapter-neon`) + Prisma 7 |
| Auth | Auth.js v5 (`next-auth@5.0.0-beta.31`) — Google OAuth + Resend magic link |
| Charts | Custom SVG (monotone-cubic Bezier, no Recharts dependency for area/line/Sankey) · Recharts for bar/donut |
| PDF | `@react-pdf/renderer` + `pdf-lib` |
| CSV | `papaparse` |
| Money | `decimal.js` **everywhere** — never `Number` arithmetic for currency |
| Forms | `react-hook-form` + `zod` v4 |
| Email | `resend` |
| FX | Frankfurter API (daily cron snapshot) |

## Data model

Three Prisma migrations define the schema:

**Phase 0 — init** (`20260514091457_init`)
- `User`, `Account`, `Session`, `VerificationToken` — Auth.js tables
- `Workspace` (slug, name, type: `INDIVIDUAL|COMPANY`, baseCurrency)
- `Membership` (userId, workspaceId, role: `OWNER|ADMIN|MEMBER|VIEWER`)
- `FinAccount` (type: `BANK|CASH|CRYPTO|BROKERAGE|CREDIT|OTHER`, currency, openingBalance)
- `Category` (kind: `INCOME|EXPENSE`, parentId for sub-categories, monthlyBudget, color)
- `Transaction` (amount + currency + fxRate + baseAmount snapshotted at write; type: `INCOME|EXPENSE|TRANSFER`)
- `Tag` + `TransactionTag`
- `FxRate` (unique on base+quote+date; source: `frankfurter|manual`)

**Phase 1** (`20260515155150_phase1_recurring_positions`)
- `RecurringRule` (freq: `DAILY|WEEKLY|MONTHLY|YEARLY`, interval, startDate, nextRunDate)
- `Position` + `Lot` + `TradeSide/UnitKind` enums (early investment model)
- `Transaction.positionId` FK

**Phase 2** (`20260517000000_phase2_invites_audit_investments`)
- `WorkspaceInvite` (token-based, role-scoped, optional email, expiresAt)
- `AuditLog` (action enum covers all CRUD + investment + membership events; entityType enum; JSONB metadata)
- `InvestmentPosition` (symbol, currency, lastPrice, realizedPl, closedAt)
- `InvestmentLot` (quantity, remainingQuantity, costPerUnit, fees, acquiredAt)
- `Dividend` (totalAmount, payDate, optional transactionId FK)

## Project structure

```
src/
  app/
    page.tsx                        # marketing landing
    sign-in/ verify-request/        # auth pages
    invite/[token]/                 # workspace invite accept
    app/
      layout.tsx                    # app shell (requires auth)
      page.tsx                      # redirect → first workspace or onboarding
      onboarding/                   # create first workspace
      [workspace]/
        layout.tsx                  # workspace shell (requireMembership)
        accounts/                   # FinAccount CRUD
        budgets/                    # per-category monthly budgets
        investments/                # positions + trade log + dividends
        notifications/              # in-app notifications
        recurring/                  # recurring transaction rules
        reports/{pnl,balance-sheet}/
        settings/
          workspace/  categories/  fx/
          members/                  # invite management + member role/remove
          activity/                 # audit log with filters
        transactions/               # ledger + CSV import/export
    api/
      auth/[...nextauth]/           # Auth.js handlers
      export/{csv,pdf}/             # streaming exports
      fx/refresh/                   # daily Frankfurter cron
      health/                       # DB ping
  components/
    charts/
      BalanceLineChart.tsx          # custom SVG monotone-cubic line + area
      CashflowBar.tsx               # Recharts bar
      CategoryDonut.tsx             # Recharts donut
      SankeyChart.tsx               # custom SVG Sankey flow
    mb/                             # MetricBase design system components
      Eyebrow  GoldButton  GridBg  KpiCard  Money  NavDiamond  Topnav  WorkspaceSwitcher
  server/
    db.ts                           # Prisma client (singleton, Neon adapter)
    auth.ts                         # Auth.js config + requireMembership()
    auth-handlers.ts
    workspace.ts                    # workspace-scoped queries
    reports.ts                      # P&L + balance sheet queries
    analytics.ts                    # dashboard aggregate queries
    audit.ts                        # AuditLog write helpers
    investments.ts                  # position + lot + dividend queries
    fx/provider.ts                  # FX cache-then-Frankfurter lookup
    actions/                        # Next.js Server Actions (one file per domain)
      accounts  categories  fx  investments  invite-accept
      members  profile  recurring  transactions  workspaces  auth
  lib/
    constants.ts  schemas.ts  utils.ts  positions.ts
```

## Key architecture rules

**Multi-tenancy** — every model carries `workspaceId`. `requireMembership(slug)` in `src/server/auth.ts` gates every protected route and Server Action. Never skip this check.

**Multi-currency** — `Transaction.amount` is in the account's native currency. `fxRate` and `baseAmount` are snapshotted at write time. Reports always use `baseAmount` — never re-convert. Same-currency transactions short-circuit to `fxRate = 1`.

**Money arithmetic** — use `decimal.js` for all calculations. Prisma returns `Decimal` objects; serialize to string at the server→client boundary. Display using the `<Money>` component (mono + tabular-nums).

**FX** — `FxRate` is unique on `(base, quote, date)`. `fx/provider.ts` checks the cache first, then hits Frankfurter on miss, and upserts. Manual overrides use `source = "manual"`.

**Server Actions** — all mutations are Next.js Server Actions in `src/server/actions/`. Each action calls `requireMembership()` first, validates with Zod, writes to DB, and writes an `AuditLog` row for any state change. Return `{ error: string } | { data: ... }`.

**Dashboard period** — `?period=` URL param (MTD / 3M / 6M / YTD / 1Y). Period constants live in `src/lib/constants.ts` (client-safe, no `server-only`).

**Design system** — MetricBase tokens are in `src/app/globals.css` via Tailwind v4 `@theme`: black/gold palette (`#0a0a0a` / `#c9a84c`), Manrope + JetBrains Mono, `border-radius: 0` everywhere. Never add `border-radius` or deviate from the token set.

## Commands

```bash
npm run dev                              # start dev server → http://localhost:3000
npm run build                            # production build
npm run lint                             # ESLint
npx tsc --noEmit                         # TypeScript type-check
npx prisma migrate dev --name <name>     # create + apply migration
npx prisma generate                      # regenerate client after schema change
npx prisma studio                        # GUI for the database
```

There is no test suite — verify changes by running the dev server.

## Running locally

```bash
npm install
cp .env.example .env.local   # fill in secrets
npx prisma migrate dev
npm run dev
```

See `README.md` for env var reference and Vercel deploy steps.
