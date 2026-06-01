# MetricBase Telegram bot

A thin [python-telegram-bot](https://python-telegram-bot.org/) worker. It holds
**no business logic**: every command calls the platform's `/api/bot/*` endpoints
with a shared `BOT_SERVICE_TOKEN`, and the platform enforces who-can-do-what by
the user's **workspace role**.

```
Telegram user ──/command──▶ bot (worker.py) ──HTTP + BOT_SERVICE_TOKEN──▶ web /api/bot/* ──▶ Postgres
                                                                                  └─▶ field-engine (analytics)
```

## How a user links their account

Linking is **verified** — a user can never just paste a Telegram id (that would
be spoofable). Ownership is proven by a round-trip:

1. In the app: **Settings → Telegram → Connect Telegram**. This creates a
   one-time code (15-min TTL, `TelegramLinkToken`) and shows a deep link
   `https://t.me/<TELEGRAM_BOT_USERNAME>?start=<code>`.
2. The user opens the bot and sends `/start <code>`.
3. The bot calls `POST /api/bot/link`; the platform validates the code, stores
   the real `telegramUserId` on the `User`, and defaults the bot's active
   workspace to the user's first membership.
4. **Disconnect** in Settings clears the link.

## Permissions

Enforced server-side via `lib/permissions.ts` `can(role, action)`:

| Role | Can use |
| --- | --- |
| **Viewer** | `/summary` `/recap` `/stock` `/liftings` (read — `field.read`) |
| **Member** | the above **+** `/addflow` (add records — `field.write`) |
| **Admin / Owner** | full access |

A viewer who tries a write gets `🔒 view only`.

## Commands

| Command | Description | Gate |
| --- | --- | --- |
| `/start <code>` | Finish linking (from Settings) | — |
| `/help` | List commands | — |
| `/whoami` | Linked account, active workspace & role | linked |
| `/workspace [n]` | Show workspaces / switch the active one | linked |
| `/summary` | Today's production snapshot | `field.read` |
| `/recap` | This month's recap | `field.read` |
| `/stock` | Current stock / tank balance | `field.read` |
| `/liftings` | Active & tentative liftings | `field.read` |
| `/addflow <node> <inflow\|outflow\|stock> <volume> [YYYY-MM-DD]` | Log a flow record | `field.write` |

**Multi-workspace:** the browser's `mb_org` cookie isn't visible to the bot, so
the active workspace is stored on the user (`telegramActiveOrgId`). `/workspace`
lists memberships; `/workspace 2` switches to the 2nd one.

## API surface (`app/api/bot/*`)

All routes are `POST`, authenticated with `Authorization: Bearer <BOT_SERVICE_TOKEN>`
and a `telegram_user_id` in the body. Shared helpers live in `server/bot.ts`
(`assertBotToken`, `resolveBotUser`, `authorizeBot`, `logBotAudit`). Every
interaction is appended to the `BotAudit` table.

`link · whoami · workspace · summary · recap · stock · liftings · flow`

The view commands proxy to the Python **field-engine** via `server/field-engine.ts`;
`/liftings` and `/addflow` hit Postgres directly (`/addflow` reuses
`createFlow()` in `server/field.ts`, the same path the web UI uses).

## Configuration

| Var | Where | Purpose |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | bot | Bot API token from [@BotFather](https://t.me/BotFather) |
| `TELEGRAM_BOT_USERNAME` | web | Bot @handle (no `@`) — builds the Settings deep link |
| `BOT_SERVICE_TOKEN` | bot **and** web | Shared secret for `/api/bot/*`. Generate once, e.g. `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PLATFORM_API_BASE` | bot | Web API base. `http://web:3000` in Docker, `http://localhost:3000` locally |

The bot loads `../.env.local` then `../.env` (same precedence as
`prisma.config.ts`), so secrets live in the platform root alongside the web app.

## Running

### Docker (deployment)

```bash
docker compose up -d --build bot web
```
`docker-compose.yml` feeds the same `.env` to both `web` and `bot`, so
`BOT_SERVICE_TOKEN` matches automatically.

### Local (no Docker)

```powershell
# terminal 1 — web
cd apps/platform; npm run dev

# terminal 2 — bot
cd apps/platform/bot
pip install -r requirements.txt
python worker.py
```

Set `PLATFORM_API_BASE="http://localhost:3000"` in `.env.local` for local runs.

The report commands (`/summary` `/recap` `/stock`) need the **field-engine**
service up. Locally:

```powershell
cd apps/platform/field-engine; .\run-local.ps1   # serves on :5001
```
and in `.env.local` set `FIELD_ENGINE_BASE="http://localhost:5001"`. The engine
opens a fresh SSL connection to remote Neon per request (~8s cold), which can
exceed the web app's 6s default — bump `FIELD_ENGINE_TIMEOUT_MS="15000"` for
local dev. Seed sample data with `field-engine/run-seed.ps1`
(`$env:REMOVE=1; .\run-seed.ps1` to remove it).
