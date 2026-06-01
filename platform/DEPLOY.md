# Deploying the MetricBase platform to a VPS

The stack runs as five Docker services behind a Cloudflare Tunnel: **web** (Next.js),
**bot** (Telegram), **field-engine** (Python analytics), **cron** (scheduler),
**cloudflared** (outbound tunnel to Cloudflare's edge). Postgres is **Neon** (managed, not a container).

> **Region matters.** The analytics engine and web app make many small queries to
> Neon. Put the VPS in the **same region as your Neon project** (currently
> `us-east-1`) — cross-region adds seconds per page. If the VPS must live
> elsewhere, move the Neon project to that region instead.

---

## 1. Prerequisites

- A VPS (2 vCPU / 4 GB+ recommended) with **Docker Engine + Compose v2**.
  No inbound ports need to be opened — the tunnel connects outbound.
- A Cloudflare account with `apps.metricbase.org` on Cloudflare DNS.
  In **Zero Trust → Networks → Tunnels**: create a tunnel, copy the token, and add a
  public hostname `apps.metricbase.org` → `http://web:3000`.
- A Telegram bot from [@BotFather](https://t.me/BotFather) (token + @username).
- Resend API key + a verified sender domain for `EMAIL_FROM`.
- Neon connection strings (pooled + direct).

---

## 2. Production `.env`

Create `/path/to/apps/platform/.env` on the VPS. **`.env.local` is for local dev and
must NOT be copied** — in particular do **not** set `PLATFORM_API_BASE` or
`FIELD_ENGINE_BASE` to `localhost`; leave them at the compose defaults so the
containers reach each other by service name.

```dotenv
# Database (Neon) — pooled for the app, direct for migrations.
DATABASE_URL="postgresql://USER:PASS@HOST-pooler.us-east-1.aws.neon.tech/DB?sslmode=require"
DIRECT_URL="postgresql://USER:PASS@HOST.us-east-1.aws.neon.tech/DB?sslmode=require"

# Auth.js — AUTH_URL/APP_URL must be the public HTTPS origin.
AUTH_SECRET="<openssl rand -base64 32>"
AUTH_URL="https://apps.metricbase.org"
APP_URL="https://apps.metricbase.org"
AUTH_GOOGLE_ID=""
AUTH_GOOGLE_SECRET=""

# Email (Resend). AUTH_RESEND_KEY = magic-link; RESEND_API_KEY = notifications.
# Usually the same key. EMAIL_FROM must be a Resend-verified sender.
AUTH_RESEND_KEY="re_..."
RESEND_API_KEY="re_..."
EMAIL_FROM="MetricBase <noreply@metricbase.org>"

# Cron auth (shared by the cron service and /api/cron/*).
CRON_SECRET="<node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\">"

# Telegram bot.
TELEGRAM_BOT_TOKEN="<from BotFather>"
TELEGRAM_BOT_USERNAME="<bot @handle, no @>"
BOT_SERVICE_TOKEN="<random secret; bot↔web>"

# Field compute engine.
FIELD_ENGINE_TOKEN="<random secret; web↔engine>"

# Cloudflare Tunnel token (from Zero Trust → Networks → Tunnels → your tunnel).
CLOUDFLARE_TUNNEL_TOKEN="<token from Cloudflare dashboard>"

# Optional integrations (leave blank if unused):
# ANTHROPIC_API_KEY / ANTHROPIC_BASE_URL / ANTHROPIC_MODEL   — AI agents
# MS_CLIENT_ID / MS_CLIENT_SECRET / MS_TENANT_ID             — OneDrive
```

Generate the three internal secrets once each:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # BOT_SERVICE_TOKEN, FIELD_ENGINE_TOKEN
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"   # CRON_SECRET
```

---

## 3. First deploy

```bash
git clone <repo> metricbase && cd metricbase/apps/platform
# create .env  (section 2)

# 1) Apply DB migrations against Neon (uses DIRECT_URL). Runs on the host;
#    install deps once or run inside a throwaway node container.
npm ci && npx prisma generate && npm run prisma:deploy

# 2) Build + start the stack.
docker compose up -d --build

# 3) Watch it come up.
docker compose ps
docker compose logs -f cloudflared   # wait for "connection registered" / tunnel healthy
```

> **Migrations are not automatic.** Run `npm run prisma:deploy` (step 1) on every
> release that includes a schema change, *before* the new `web` container serves
> traffic.

---

## 4. Smoke tests

```bash
# Health (no auth)
curl -s https://apps.metricbase.org/api/health

# Email digest (replace with your CRON_SECRET) → {"ok":true,"sent":N}
curl -s "https://apps.metricbase.org/api/cron/email-digest?secret=$CRON_SECRET"
```

Then in a browser:
1. Sign in (magic link / Google) at `https://apps.metricbase.org`.
2. **Settings → Telegram → Connect**, send `/start <code>` to the bot, then
   `/whoami`, `/summary`, `/liftings` — confirm role-gating works.
3. Open `/field/reports` — analytics should render in well under a second
   (if slow, your VPS↔Neon region is mismatched — see the note up top).

Logs: `docker compose logs -f bot`, `... field-engine`, `... cron`.

---

## 5. Updating

```bash
git pull
npx prisma generate && npm run prisma:deploy   # only if migrations changed
docker compose up -d --build                   # rebuilds changed images
```
Bot/cron/engine changes: `docker compose up -d --build bot cron field-engine`.

## 6. Rollback

```bash
git checkout <previous-good-sha>
docker compose up -d --build
```
Migrations are additive and not auto-reverted; for a schema rollback restore the
Neon branch/backup from before the migration. Keep deploys small so rollbacks are cheap.

---

## 7. Pre-launch checklist

- [ ] `.env` complete; `PLATFORM_API_BASE`/`FIELD_ENGINE_BASE` left at defaults
- [ ] `AUTH_URL`/`APP_URL` = `https://apps.metricbase.org`
- [ ] Cloudflare Tunnel token set; tunnel shows **Healthy** in Zero Trust dashboard
- [ ] `prisma migrate deploy` run against prod Neon
- [ ] BotFather token + `TELEGRAM_BOT_USERNAME` set; bot links successfully
- [ ] Resend sender verified; digest smoke test returns `sent: N`
- [ ] **Sample/demo data removed** from prod Neon (the `SD-` field rows):
      `cd field-engine && $env:REMOVE=1; .\run-seed.ps1`  (or set `REMOVE=1` and run `_seed.py`)
- [ ] VPS region matches Neon region (`us-east-1`)

## Tuning

- `FIELD_ENGINE_TIMEOUT_MS` (web) — web→engine timeout, default `6000`. If
  analytics ever exceed it under load, raise it.
- `FIELD_ENGINE_POOL_MIN` / `FIELD_ENGINE_POOL_MAX` (engine) — pre-warmed pool
  size, default `2`/`8`.
- Cron schedules live in `cron/entrypoint.sh` (UTC).
