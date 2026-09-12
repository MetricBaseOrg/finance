# Bingkai

Campaign photo frames — the kind Indonesians call a *twibbon* — that never upload the
supporter's photo.

Production: `bingkai.metricbase.org` *(not deployed yet)*

## Why this exists

Twibbonize and services like it work server-side: the supporter uploads a photo, the
server composites the frame onto it, and the result comes back — often watermarked, with
ads on the way, and with a stranger's face now sitting on someone else's disk.

None of that is necessary. A frame is a transparent PNG drawn on top of a photo, and
every browser has had a canvas for fifteen years. So here the frame travels *to* the
device and the photo never leaves it.

That single architectural choice is what the whole product argument rests on:

| | Bingkai | Typical twibbon service |
|---|---|---|
| Photo processed on the supporter's device | Yes | No, uploaded |
| Watermark on the result | Never | Usually, unless paid |
| Ads shown to supporters | None | Common |
| Account needed to create a campaign | No | Yes |
| Personalised text inside the frame | Yes | No |
| Story / feed / print export presets | Yes | One size |
| Works on a weak connection | Yes, after first load | No |

The watermark is the tell. You can only stamp a watermark on an image if you are the one
producing it. We never hold the pixels, so there is nothing to stamp and no upsell to
remove it.

## What is built

- **Landing page** — the pitch and the comparison.
- **`/buat`** — create a campaign. Upload one transparent PNG, optionally add text
  fields, get two links back.
- **`/k/[slug]`** — the supporter editor. Pick a photo, drag and pinch to position,
  fill in the personalised fields, export at any preset, share to the native sheet, or
  take every size at once as a ZIP. All client-side.
- **`/kelola/[key]`** — the organiser's numbers: visits, photo-picks, downloads,
  referring hosts, and which export sizes people actually use.
- **`/api/campaigns`**, **`/api/campaigns/[slug]`**, **`/api/events`**.

### Not built yet

- Bulk generation from a CSV (the organiser-side ZIP). `parseCsv` in `src/lib/compose.ts`
  is already there for it.
- Animated/video frames for Stories.
- QR code for print posters.
- Closing a campaign from the manage page (the schema supports `closedAt`; there is no
  button yet).

## Design decisions worth knowing

**No accounts, either side.** A campaign is owned by whoever holds its `manageKey`,
handed over once at creation. Registration is the biggest drop-off for the people who
actually run these — a school admin the night before, a committee volunteer on a phone —
and an unlisted secret link is a proportionate trust model for a photo frame. There is
no `User` model and that is deliberate.

**Analytics that cannot betray the pitch.** Counters only: no IP, no cookie, no device
fingerprint, nothing derived from the request that identifies anyone. Timestamps are
truncated to the hour so two supporters in the same hour are indistinguishable, and the
referrer is reduced to a bare host so an organiser can tell WhatsApp from Instagram
without learning anything about a person.

**Frames live in the row as a data URL.** A transparent campaign frame is 80–600 KB, and
this keeps v1 to one managed service. When frame size or volume makes that wrong, move
`frameData` to blob storage and keep a URL in its place; nothing else in the schema
changes.

**Fonts are vendored, not fetched.** `next/font/google` downloads at build time, so a
build machine that cannot reach Google fails outright — which happened during this
build. Both families ship as one variable-weight file each. See
`src/fonts/LICENSE-fonts.txt`.

**Cover-fit, not contain.** A frame is a window; letterboxing a photo inside a campaign
frame looks broken and every supporter would have to fix it by hand.

**Shrink-to-fit text.** A name that overflows is bad; a clipped name on a graduation
frame is unacceptable. Fields reduce their own size until they fit.

## Local development

```bash
npm install
npm run dev          # http://localhost:3000
```

It runs with **no database**. With `DATABASE_URL` unset the store writes to
`.devdata/db.json` and every feature works, so the app is demonstrable immediately.
Point `DATABASE_URL` at Neon and the same calls go to Postgres.

```bash
cp .env.example .env
# set DATABASE_URL, then:
npm run db:push
```

Prisma 7 takes the connection string from `prisma.config.ts` for the CLI and a
`PrismaPg` adapter at runtime — the schema's `datasource` block no longer holds a URL.
Same arrangement as `apps/platform`.

## Deploy

Not yet deployed. When it is:

1. Vercel project with **root directory** `apps/bingkai/`.
2. Attach Neon, set `DATABASE_URL`, `DIRECT_URL` and `NEXT_PUBLIC_SITE_URL`.
3. `npm run db:push` (or add a migration) against the production branch.
4. Point `bingkai.metricbase.org` at the Vercel project in Cloudflare DNS.

## Naming

*Bingkai* is Indonesian for **frame**. It is what people already say when they talk
about these ("bingkai twibbon"), so it carries the search intent in the market where
this category is largest, and it stays pronounceable everywhere else.
