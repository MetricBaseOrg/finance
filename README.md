# apps

Hosted and in-development **MetricBase** web apps live here. Each subdirectory is its own deployable project — separate `package.json`, dependencies, env vars, and Vercel project.

The static editorial site and Blogger templates live in [`../MetricBase/`](../MetricBase/). This tree is for **dynamic** or **authenticated** products only.

## Projects

| Directory | Description | Production |
| --- | --- | --- |
| [`financial-tracker`](./financial-tracker/) | Multi-tenant financial tracker for individuals + companies. Multi-currency (IDR/USD), P&L + balance sheet, investments + dividends, recurring transactions, workspace invites, audit log, CSV/PDF export. Next.js 16 · Prisma 7 + Neon · Auth.js v5. | [`apps.metricbase.org`](https://apps.metricbase.org) |

## Conventions

- One project per directory, named in lowercase with hyphens (e.g. `financial-tracker`).
- Each project owns its own `README.md` with local dev + deploy instructions.
- Each project deploys as its own Vercel project with **root directory** set to `apps/<name>/`.
- Each project owns its own subdomain under `apps.metricbase.org`, or shares the root if it is the primary app.
- Brand: every project reuses MetricBase design tokens — `#0a0a0a` background, `#c9a84c` gold, Manrope + JetBrains Mono, sharp corners. See [`../MetricBase/CLAUDE.md`](../MetricBase/CLAUDE.md) for the full spec.

## Stack defaults

When starting a new project here, default to:

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind v4
- **DB:** Neon Postgres via Vercel Marketplace + Prisma (or Prisma + driver-adapter for serverless)
- **Auth:** Auth.js v5 — Resend magic link + Google OAuth
- **Hosting:** Vercel
- **Money:** `decimal.js` everywhere; never `Number` arithmetic

Deviate only with a reason.

## Adding a new app

1. `cd apps && npx create-next-app@latest <name> --typescript --tailwind --app --src-dir --import-alias "@/*"`
2. Port the MetricBase design tokens into `src/app/globals.css` (copy from `financial-tracker/src/app/globals.css`).
3. Add the project to the table above.
4. Create a Vercel project pointing at `apps/<name>/`, attach Neon, configure env vars, and add the subdomain.
5. Reuse `financial-tracker/vercel.json` as the deploy template (build command + cron block).

## Legal & brand

User-facing legal copy for these apps lives at:

- [Privacy Policy](https://metricbase.org/privacy) — Section 12 · APPS
- [Terms of Service](https://metricbase.org/terms) — Section 16 · APPS
- [Disclaimer](https://metricbase.org/disclaimer) — Section 12 · APPS
- [Cookie Policy](https://metricbase.org/cookie-policy) — Section 09 · APPS

Update those sections (in the static site repo) whenever an app collects new data types, adds new processors, or changes its retention / deletion behavior.
