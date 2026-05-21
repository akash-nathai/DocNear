# ────────────────────────────────────────────────────────────────────────────
# DocNear API — multi-stage Dockerfile
# ────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ──────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
# Use corepack for reproducible pnpm version
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ── Stage 2: Builder ───────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules 2>/dev/null || true
COPY . .
# Generate Prisma client (requires schema only, not a live DB)
RUN DATABASE_URL="postgresql://x:x@localhost:5432/x" \
    pnpm --filter @docnear/api exec prisma generate
# Build shared packages
RUN pnpm --filter @docnear/shared-types build 2>/dev/null || true
# Build API
RUN pnpm --filter @docnear/api build

# ── Stage 3: Runner (non-root, minimal) ───────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy only what's needed to run
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
# Copy the generated Prisma client from node_modules
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

USER nestjs
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:4000/v1/health || exit 1

CMD ["node", "dist/main"]
