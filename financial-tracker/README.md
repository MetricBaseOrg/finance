# MetricBase Financial Tracker

Multi-tenant financial tracker for individuals and companies. Multi-currency (IDR/USD), multi-workspace, full P&L + balance sheet, CSV import/export, investment positions + lots + dividends, recurring transactions, workspace invites, audit log.

- **Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Prisma 7 + Neon · Auth.js v5 · custom SVG charts · pdf-lib · decimal.js
- **Deploy:** Vercel → `apps.metricbase.org`

## Local dev

```powershell
npm install
cp .env.example .env.local   # fill in secrets — see below
npx prisma migrate dev --name init
npm run dev
```

Open <http://localhost:3000>.

### Required env vars (`.env.local`)

| Variable | How to get |
| --- | --- |
| `DATABASE_URL` | Neon pooled connection string (free tier at console.neon.tech) |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `AUTH_URL` | `http://localhost:3000` locally; `https://apps.metricbase.org` in prod |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google Cloud Console → OAuth 2.0 client (Web). Redirect URI: `<AUTH_URL>/api/auth/callback/google` |
| `AUTH_RESEND_KEY` | resend.com API key (free 3k emails/mo) |
| `AUTH_EMAIL_FROM` | `onboarding@resend.dev` until your sending domain is verified |
| `FX_PROVIDER_URL` | `https://api.frankfurter.app` (default) |
| `CRON_SECRET` | Random token used to auth Vercel cron calls |

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Marketing landing |
| `/sign-in` · `/verify-request` | Auth (Google OAuth + magic link) |
| `/app` | Redirect to first workspace or onboarding |
| `/app/onboarding` | Create first workspace |
| `/app/[ws]/dashboard` | KPI cards · cashflow bar · category donut · Sankey flow · recent transactions |
| `/app/[ws]/transactions` | Ledger with filters · CSV import · CSV export |
| `/app/[ws]/accounts` | FinAccount CRUD with inline editing |
| `/app/[ws]/investments` | Investment positions + trade log |
| `/app/[ws]/recurring` | Recurring transaction rules |
| `/app/[ws]/budgets` | Per-category monthly budgets + progress |
| `/app/[ws]/reports/{pnl,balance-sheet}` | Reports + PDF export |
| `/app/[ws]/settings/{workspace,categories,fx}` | Settings · inline category editing |
| `/app/[ws]/settings/members` | Invite management + member role/remove |
| `/app/[ws]/settings/activity` | Audit log with filters |
| `/app/[ws]/notifications` | In-app notifications |
| `/app/profile` | Profile picture + display name |
| `/invite/[token]` | Workspace invite accept |
| `/api/auth/[...nextauth]` | Auth handlers |
| `/api/export/{csv,pdf}` | Streaming exports |
| `/api/fx/refresh` | Daily Frankfurter FX snapshot (cron) |
| `/api/health` | DB ping |

## Architecture notes

- **Multi-tenancy** — every model carries `workspaceId`. `requireMembership(slug)` gates every protected route and server action.
- **Multi-currency** — `Transaction.amount` is in the account's currency; `fxRate` and `baseAmount` are snapshotted at write time so reports never re-convert. Same-currency transactions short-circuit to rate 1.
- **FX cache** — `FxRate` table is unique on `(base, quote, date)`. Provider helper checks cache first, then Frankfurter on miss, and upserts. Manual overrides set `source = "manual"`.
- **Money** — all arithmetic uses `decimal.js`. Display via `<Money>` (mono + tabular-nums). Decimal objects are serialized to strings at the server→client boundary.
- **Dashboard timeframe** — period selection (MTD / 3M / 6M / YTD / 1Y) is URL-state via `?period=`. Shared constants live in `src/lib/periods.ts` (client-safe, no `server-only` dependency).
- **Sankey chart** — custom SVG port of the MetricBase design system (`chart-sankey.jsx`). Proportional flow ribbons, de-overlapped labels with leader lines, hover highlight. No Recharts dependency.
- **Investments** — position-linked transactions (those with a `positionId`) are grouped as "Investments" in the dashboard breakdown instead of "Uncategorized".
- **CSV import** — template download generates a CSV pre-filled with the workspace's actual account and category names. Import action validates each row, resolves names to IDs, fetches FX rates, and returns per-row errors.
- **Design system** — MetricBase tokens (black/gold, Manrope + JetBrains Mono, sharp corners) in `src/app/globals.css` via Tailwind v4 `@theme`. Reference: `metricbase-design-system/`.

## Deploy to Vercel

1. Push repo to GitHub.
2. New Vercel project, **root directory** `apps/financial-tracker`.
3. Add Neon via Vercel Marketplace (auto-injects `DATABASE_URL`).
4. Add domain `apps.metricbase.org`; DNS: CNAME `apps` → `cname.vercel-dns.com`.
5. Set env vars in Vercel project settings. Set `AUTH_URL` to `https://apps.metricbase.org`. Add the prod redirect URI to your Google OAuth client.
6. Build command (from `vercel.json`): `prisma generate && prisma migrate deploy && next build`.
7. Verify cron `/api/fx/refresh` is listed under Project → Cron (auto-picked from `vercel.json`).

## Status

### Phase 0 — complete

| Milestone | Status |
| --- | --- |
| M1 Foundation | ✓ |
| M2 Auth + Workspaces | ✓ |
| M3 Accounts & Categories | ✓ |
| M4 Transactions + FX | ✓ |
| M5 Dashboard + Budgets | ✓ |
| M6 Reports + Export | ✓ |
| M7 FX cron + Settings | ✓ |
| M8 Polish + Deploy | ✓ |

### Phase 1 — complete

| Feature | Status |
| --- | --- |
| Recurring transactions | ✓ |
| Investment positions + trade log | ✓ |
| Profile picture | ✓ |
| Inline account + category editing | ✓ |
| CSV import | ✓ |
| Dashboard timeframe picker | ✓ |
| Custom Sankey flow chart | ✓ |
| MetricBase design system | ✓ |

### Phase 2 — complete

| Feature | Status |
| --- | --- |
| Workspace invites (token-based, role-scoped) | ✓ |
| Member management (role change, remove) | ✓ |
| Audit log (all create/update/delete/invest events) | ✓ |
| Investment positions + lots + dividends (v2 model) | ✓ |
| Notifications page | ✓ |

### Phase 3 — planned

Bank feeds (Plaid/Brick), OCR receipts, Stripe billing, public API, price alerts, more currencies.
