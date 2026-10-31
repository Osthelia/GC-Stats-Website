# syntax=docker/dockerfile:1

# GC-Stats V2 (apps/web), npm workspaces monorepo build.
#
# Stages:
#   deps     -> installs the full workspace tree (incl. devDependencies)
#   builder  -> runs `next build` (output: "standalone", see next.config.mjs)
#   migrator -> drizzle-orm + pg only, applies packages/db/drizzle (no drizzle-kit)
#   runner   -> slim runtime image, only the traced standalone server

ARG NODE_VERSION=24-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/map-stats-engine/package.json packages/map-stats-engine/package.json
# Workspace layout must exist before `npm ci` so symlinks land correctly.
RUN npm ci

FROM base AS builder
COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /repo/packages ./packages
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Optional CDN host for /_next/static (e.g. https://static.gc-stats.app). Baked into the build by Next.js, so an image built
# with it points at that host everywhere it runs. Empty = assets served by the app itself.
ARG ASSET_PREFIX=
ENV ASSET_PREFIX=${ASSET_PREFIX}
RUN npm run build --workspace=apps/web

# Migration image (Argo CD PreSync Job, and `docker compose run migrate`): drizzle-orm and pg only, installed from
# packages/db/migrate/package-lock.json, plus the raw drizzle/ SQL folder and migrate.mjs. No drizzle-kit, esbuild or tsx
# (they pulled in the whole workspace and a vulnerable esbuild binary): nothing to scan or patch beyond the base image.
FROM node:${NODE_VERSION} AS migrator-deps
WORKDIR /app
COPY packages/db/migrate/package.json packages/db/migrate/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:${NODE_VERSION} AS migrator
ENV NODE_ENV=production
# npm and corepack ship their own dependency copies and are not needed at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=migrator-deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node packages/db/migrate/package.json packages/db/migrate/migrate.mjs ./
COPY --chown=node:node packages/db/drizzle ./drizzle
USER node
CMD ["node", "migrate.mjs"]

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

# npm, yarn and corepack are not needed at runtime and their bundled dependencies (brace-expansion, undici...) are flagged by Trivy
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* /usr/local/bin/yarn*

USER nextjs
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
