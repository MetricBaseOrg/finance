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
# Generate the Prisma client (output: app/generated/prisma) then build.
RUN npx prisma generate && npm run build

# ─── runtime ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

# Next.js standalone output bundles the server + traced deps.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Custom Prisma output (app/generated/prisma) is not traced by Next.js
# standalone — copy it explicitly so the client and engine binary are present.
COPY --from=build /app/app/generated/prisma ./app/generated/prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
