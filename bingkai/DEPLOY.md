# Deploying Bingkai

Target: `bingkai.metricbase.org`

## Status, 2026-09-13: LIVE on Vercel, waiting on one DNS record

| Piece | State |
|---|---|
| Vercel project `metricbase/bingkai`, functions pinned to **sin1** (Singapore) | Live |
| Production env: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SITE_URL` | Set, encrypted |
| Public alias | https://bingkai-seven.vercel.app |
| End-to-end check: campaign created over HTTPS, page and API read back, row confirmed in Neon by SQL | Passed |
| Oversize frame (3.1 MB) rejected by the app with its own 413 message | Passed |
| `bingkai.metricbase.org` added to the project | Added, **DNS not set** |

**The one remaining step** is in Cloudflare, zone `metricbase.org`:

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `bingkai` | `76.76.21.21` | DNS only (grey cloud) |

It must be DNS only. With the orange-cloud proxy on, Cloudflare terminates TLS itself
and Vercel cannot complete its own certificate issuance. Vercel emails when it verifies.

A test campaign `test-deploy-check-hapus-6ey3` exists in production from the check
above. It is harmless and can be deleted once a real campaign exists.

### Two Vercel-specific changes made for this deploy

* **Frame cap lowered from 5 MB to 3 MB**, client and server. The frame travels as base64
  inside JSON, which inflates it by a third, and Vercel rejects any function request
  over 4.5 MB before the handler runs. A 5 MB PNG arrived as ~6.7 MB, so the organiser
  would have seen a raw English platform 413 instead of the Indonesian message. 3 MB
  encodes to ~4.0 MB. A 1080x1080 frame is normally well under 1.5 MB.
* **`vercel.json` pins functions to `sin1`**, next to Neon in `aws-ap-southeast-1`. The
  default is Washington, which would put an ocean between every request and its
  database. The first deploy's `x-vercel-id` headers confirm `sin1`.
* **`.vercelignore` excludes `.env`**. A CLI deploy uploads the working directory, and
  that file holds the live Neon credentials; production reads its variables from the
  project settings instead.

Redeploy from this directory with a token in `VERCEL_TOKEN`:

```powershell
vercel deploy --prod --yes --scope metricbase --token $env:VERCEL_TOKEN
```

---

The sections below are the original runbook, kept for the self-hosted path.

## Done already

| Step | State |
|---|---|
| Neon project `bingkai` (`shiny-bread-52751987`), region `aws-ap-southeast-1` | Created |
| Database `bingkai`, schema pushed (`Campaign`, `Event`, `EventKind`) | Live |
| App verified against Neon end to end (campaign created, row confirmed by SQL) | Passed |
| Production build, standalone output, Dockerfile + compose + Caddyfile | Ready |
| Code on `origin/main` of `MetricBaseOrg/apps` | Pushed |

Region note: Neon is in Singapore, which is the closest Neon region to the Indonesian
audience this app is aimed at. **Put the host in the same region.** `apps/platform`
learned this the hard way — cross-region adds seconds per page when a request makes
several small queries.

## What is blocked, and why

| Path | Blocker |
|---|---|
| Vercel | The stored CLI token is invalid and `vercel login` needs a browser |
| Railway | The connector authenticates as `bun@metricbase.org` but has no write scope — `create_project` returns Unauthorized |
| Cloudflare DNS | The Cloudflare connectors are not authorised in this session |

So the last mile is yours. Two options.

## Option A — the VPS, same as apps/platform (recommended)

This matches the house pattern: Docker behind Caddy with auto-TLS, Neon as the
database. Files are in place.

```bash
# on the VPS
git clone https://github.com/MetricBaseOrg/apps.git
cd apps/bingkai

cat > .env <<'ENV'
DATABASE_URL="<pooled Neon URL>"
DIRECT_URL="<unpooled Neon URL>"
NEXT_PUBLIC_SITE_URL="https://bingkai.metricbase.org"
ENV

docker compose up -d --build
docker compose logs -f web        # expect: ready on :3000
```

DNS: an **A record** `bingkai.metricbase.org → <VPS IP>`, with ports 80 and 443 open
so Caddy can complete the ACME challenge.

**If this lands on the VPS that already runs `apps/platform`**, that box already has a
Caddy holding 80 and 443. Delete the `caddy` service from `docker-compose.yml` here and
paste the block from `Caddyfile` into the platform's Caddy instead. Two Caddys cannot
share those ports.

The connection strings are in `apps/bingkai/.env` on this machine (gitignored), and in
the Neon console under project `bingkai`.

## Option B — Vercel, per the original apps/README convention

```bash
cd apps/bingkai
vercel login
vercel link          # scope: MetricBaseOrg, root directory: apps/bingkai
vercel env add DATABASE_URL production
vercel env add DIRECT_URL production
vercel env add NEXT_PUBLIC_SITE_URL production
vercel --prod
vercel domains add bingkai.metricbase.org
```

Then point the domain at Vercel in Cloudflare DNS as Vercel instructs. `output:
"standalone"` in `next.config.ts` is harmless on Vercel — it ignores it.

This is the path that was taken. See the status section at the top.

## After it is up

1. Create a real campaign at `/buat` and keep the manage link.
2. Confirm in DevTools → Network that picking a photo produces **no upload**. That is
   the product's entire claim and it should be verifiable by anyone in ten seconds.
3. Check `/kelola/<key>` shows the visit.
4. Add the legal sections for this app to metricbase.org — Privacy §12, Terms §16,
   Disclaimer §12, Cookie §09 — as `apps/README.md` requires. Bingkai sets **no
   cookies at all**, which is worth stating explicitly rather than leaving implied.

## Rollback

`docker compose down` on the VPS, or `vercel rollback`. The database is untouched by
either. Nothing in the schema is destructive to re-push.
