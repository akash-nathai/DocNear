# DocNear — Doctor Booking Platform

> India-first, geolocation-based doctor appointment booking. Competitor to QuickoBook / Practo.

## Architecture

See [docs/01-ARCHITECTURE.md](docs/01-ARCHITECTURE.md) for full system design.

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 20 | [nvm](https://github.com/nvm-sh/nvm) — `nvm use` |
| pnpm | ≥ 9 | `npm i -g pnpm@9` |
| Docker | any | [docker.com](https://docker.com) |
| Docker Compose | v2 | bundled with Docker Desktop |

## Quick Start

```bash
# 1. Use correct Node version
nvm use   # reads .nvmrc → Node 20

# 2. Install dependencies
pnpm install

# 3. Start infrastructure (PostgreSQL + Redis + Meilisearch + MinIO)
docker compose -f infra/docker/docker-compose.yml up -d

# 4. Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# 5. Run database migrations + seed
pnpm db:migrate
pnpm db:seed

# 6. Start dev servers (API on :4000, Web on :3000)
pnpm dev
```

## Workspace Structure

```
docnear/
├── apps/
│   ├── api/        NestJS API          → http://localhost:4000/v1
│   ├── web/        Next.js 14          → http://localhost:3000
│   └── mobile/     Expo (React Native) → expo start
├── packages/
│   ├── shared-types/   Shared TypeScript types
│   ├── ui/             shadcn/ui component library
│   └── config/         ESLint, TSConfig, Tailwind presets
├── infra/
│   └── docker/     docker-compose + NGINX config
└── docs/           Architecture, DB design, API contracts
```

## Key Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start API + Web in watch mode |
| `pnpm build` | Build all workspaces |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | TypeScript check all workspaces |
| `pnpm test` | Run unit tests |
| `pnpm db:studio` | Open Prisma Studio |
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:seed` | Seed development data |

## Health Checks

- API: `curl http://localhost:4000/v1/health`
- Meilisearch: `curl http://localhost:7700/health`
- MinIO Console: `http://localhost:9001` (admin / minioadmin123)

## Environment Tiers

| Env | URL | Notes |
|-----|-----|-------|
| dev | localhost | Docker Compose stack |
| staging | staging.docnear.in | Auto-deploy on `main` |
| prod | docnear.in | Manual approve on `release/*` |

## Tech Stack

- **API:** NestJS 10 + TypeScript + Prisma + PostgreSQL 16 + Redis 7
- **Web:** Next.js 14 (App Router) + TailwindCSS + shadcn/ui + next-intl
- **Mobile:** Expo + React Native + expo-router + NativeWind
- **Search:** Meilisearch | **Queue:** BullMQ | **Storage:** MinIO / S3
- **Payments:** Razorpay | **Video:** 100ms SDK | **Auth:** JWT RS256 + OTP
