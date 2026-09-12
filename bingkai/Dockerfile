# Modelled on apps/platform/Dockerfile, which is proven on the VPS.
# Differences: the Prisma client generates to src/generated/prisma here, and there
# is no bot/cron/field-engine — bingkai is one Next.js service.

# ─── deps ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ─── build ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `npm run build` already runs `prisma generate`, but run it explicitly so a
# failure here is attributable rather than buried in the Next build output.
RUN npx prisma generate && npm run build

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
