# ────────────────────────────────────────────────────────────────────────────
# DocNear API — multi-stage Dockerfile
# Build context = monorepo root (set via railway.toml dockerfilePath).
# .dockerignore at the root excludes node_modules so COPY . . is safe.
# ────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ─────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# pnpm needs EVERY workspace package.json to build the dependency graph.
# Missing even one causes `--frozen-lockfile` to fail immediately.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json       ./packages/config/
COPY packages/ui/package.json           ./packages/ui/
COPY apps/api/package.json              ./apps/api/
COPY apps/web/package.json              ./apps/web/
COPY apps/mobile/package.json           ./apps/mobile/

RUN pnpm install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9 --activate

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy full monorepo source (.dockerignore keeps node_modules out)
COPY . .

# 1) Compile @docnear/shared-types to JS.
#    Enums are runtime values — without this, Node tries to load .ts files.
RUN pnpm --filter @docnear/shared-types build

# 2) Generate Prisma client (schema-only, no live DB needed)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" \
    pnpm --filter @docnear/api exec prisma generate

# 3) Compile the NestJS API
RUN pnpm --filter @docnear/api build

# ── Stage 3: Lean production image ────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Run as non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nestjs

# Compiled API
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist        ./dist

# Prisma schema + migrations (needed for `prisma migrate deploy`)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma      ./prisma

# node_modules — Docker FOLLOWS the @docnear/shared-types symlink, so the
# compiled dist/ from packages/shared-types/dist/ is copied in automatically.
COPY --from=builder --chown=nestjs:nodejs /app/node_modules         ./node_modules

# package.json (NestJS reads name/version; prisma CLI needs it too)
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

USER nestjs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

CMD ["node", "dist/main"]
