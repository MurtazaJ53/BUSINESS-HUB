# Production image for the admin web application.
#
# Build context is THIS directory — the app has its own pnpm-lock.yaml and is
# self-contained:
#   docker build -t business-hub-web apps/admin_web
#
# Two things the previous version got wrong and this fixes:
#   - it ran `npm ci`, but there is no package-lock.json; the project uses pnpm
#   - it copied .next/standalone, which is only produced when next.config.ts
#     sets output: "standalone"
FROM node:20-alpine AS base
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1

# --- dependencies ---------------------------------------------------------
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- build ----------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

# --- runtime --------------------------------------------------------------
# The standalone bundle is ~20 MB and carries only the modules actually used,
# which matters on a shared 2 GB droplet.
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
# HOSTNAME must be 0.0.0.0 or the server binds to localhost inside the
# container and Docker cannot reach it.
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
