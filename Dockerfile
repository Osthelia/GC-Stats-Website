# syntax=docker/dockerfile:1

# GC-Stats V2 (apps/web), npm workspaces monorepo build.
#
# Stages:
#   deps     -> installs the full workspace tree (incl. devDependencies)
#   builder  -> runs `next build` (output: "standalone", see next.config.mjs)
#   migrator -> reuses `builder` node_modules to run drizzle-kit migrations
#   runner   -> slim runtime image, only the traced standalone server

ARG NODE_VERSION=24-slim

# workerd (used by `wrangler types`) ships glibc-only prebuilt binaries and
# crashes on Alpine/musl, so the build needs a glibc-based image.
FROM node:${NODE_VERSION} AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/bracket-engine/package.json packages/bracket-engine/package.json
# Workspace layout must exist before `npm ci` so symlinks land correctly.
RUN npm ci

FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# cloudflare-env.d.ts is gitignored (regenerated from wrangler.jsonc), so it
# must be built here rather than relying on whatever's in the build context.
RUN npm run cf-typegen --workspace=apps/web
RUN npm run build --workspace=apps/web

# One-off image for `docker compose run migrate`, needs drizzle-kit
# (devDependency) and the raw drizzle/ SQL folder, neither of which ship in
# the standalone runtime image.
FROM builder AS migrator
WORKDIR /repo/packages/db
CMD ["npx", "drizzle-kit", "migrate"]

FROM node:${NODE_VERSION} AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# `output: "standalone"` traces only the node_modules this app actually
# needs and mirrors the monorepo path (outputFileTracingRoot in
# next.config.mjs), public/ and .next/static are not included and must be
# copied in separately.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
