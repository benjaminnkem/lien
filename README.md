# Lien

**Lien** (Lien) is a pre-mint and pre-collateralization firewall for Real-World Assets (RWAs). It prevents the same real-world asset — especially invoices and receivables — from being tokenized or pledged multiple times across platforms or chains.

Built for the **Cleanverse Hackathon** with deep integration of **CVI** (identity) and **CVA** (verified assets).

## Monorepo structure

```
apps/
  web/          → Next.js frontend (App Router, Tailwind, wagmi, RainbowKit)
  api/          → NestJS backend (TypeORM + PostgreSQL)
packages/
  sdk/          → Shared types, fingerprint utilities (@repo/sdk)
  ui/           → Shared React primitives (@repo/ui)
  typescript-config/
  eslint-config/
```

## Prerequisites

- Node.js ≥ 20
- [pnpm](https://pnpm.io/) 9
- Docker (for PostgreSQL)

## Quick start

```bash
# Install dependencies
pnpm install

# Start PostgreSQL
pnpm db:up

# Build shared packages, then run web + api
pnpm dev
```

| Service  | URL                                   |
| -------- | ------------------------------------- |
| Web      | http://localhost:3000                 |
| API      | http://localhost:3001/api             |
| Health   | http://localhost:3001/api/health      |
| Postgres | localhost:5433 (user/pass/db: `lien`) |

### Env files

Copy examples if needed:

- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.example` → `apps/web/.env.local`

Optional: set a real [WalletConnect Cloud](https://cloud.walletconnect.com/) project id in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

## Scripts

| Command        | Description                       |
| -------------- | --------------------------------- |
| `pnpm dev`     | Dev servers for web + api (+ sdk) |
| `pnpm build`   | Build all packages and apps       |
| `pnpm db:up`   | Start Postgres via Docker Compose |
| `pnpm db:down` | Stop Postgres                     |
| `pnpm lint`    | Lint all packages                 |

## Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS 4, RainbowKit, wagmi, viem, TanStack Query, Zod
- **Backend:** NestJS 11, TypeORM, PostgreSQL, class-validator
- **Shared:** `@repo/sdk` (fingerprint + types), Turborepo monorepo

## MVP roadmap (next)

1. Asset fingerprint API + UI form
2. Encumbrance registry (Postgres + on-chain)
3. CVA mint gate (Cleanverse adapter)
4. Lien registration on finance
5. Issuer / Lender / Compliance dashboards
6. Hardhat contracts (`apps/contracts`)
