# Lien

**Lien** (Lien) is a pre-mint and pre-collateralization firewall for Real-World Assets (RWAs). It prevents the same real-world asset — especially invoices and receivables — from being tokenized or pledged multiple times across platforms or chains.

Built for the **Cleanverse Hackathon** with deep integration of **CVI** (identity) and **CVA** (verified assets).

## Monorepo structure

```
apps/
  web/          → Next.js frontend (App Router, Tailwind, wagmi, RainbowKit)
  api/          → NestJS backend (TypeORM + SQLite/PostgreSQL)
  contracts/    → Hardhat EncumbranceRegistry
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
| Swagger  | http://localhost:3001/api/docs        |
| Postgres | localhost:5433 (user/pass/db: `lien`) |

### Env files

Copy examples if needed:

- `apps/api/.env.example` → `apps/api/.env`
- `apps/web/.env.example` → `apps/web/.env.local`

Optional: set a real [WalletConnect Cloud](https://cloud.walletconnect.com/) project id in `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`.

### Cleanverse UAT demo identities

The issuer and both lenders are fail-closed behind Cleanverse A-Pass checks.
Add the server-side Cleanverse credentials and public UAT identity values to
`apps/api/.env`:

```bash
CLEANVERSE_BASE_URL=https://uatapi.cleanverse.com/api/cooperate
CLEANVERSE_API_ID=your-api-id
CLEANVERSE_API_KEY=your-api-key

DEMO_CHAIN=base
DEMO_ATOKEN_ADDRESS=cleanverse-issued-atoken-address
DEMO_ISSUER_WALLET=wallet-with-active-apass
DEMO_LENDER_A_WALLET=wallet-with-active-apass
DEMO_LENDER_B_WALLET=wallet-with-active-apass
```

The wallets and A-Token are public chain identifiers; the API id/key are never
sent to `apps/web`. Use wallets that already have active, unexpired sandbox
A-Passes. If a sandbox identity is missing, frozen, expired, or ineligible for
the A-Token, the API returns a specific `CVI_*` code and records the failed gate
in the audit trail. `POST /api/demo/seed` refuses to fabricate verification when
these values are missing.

## Five-minute judge path

1. Open `http://localhost:3000/issuer`. Confirm the issuer shows **Sandbox
   ready**, submit the invoice, and see **CVI verified** plus **Registry clean**.
2. Continue to `/lender`, open the highlighted invoice, and finance as Lender A.
   The API runs `query_apass` and `verify_apass` before registering priority #1.
3. Switch to Lender B and retry the same fingerprint. Lender B is verified first,
   then the registry responds `409 / FINANCING_BLOCKED` with the existing lien.
4. Open `/compliance` to inspect the issuer/lender CVI events, first lien, and
   duplicate rejection for the same fingerprint.
5. Export the filtered evidence with **CSV** or **JSON**. For a one-click fallback,
   choose **Seed judge scenario** on `/compliance`; it creates a fresh verified
   invoice, finances it once, and optionally captures the conflicting attempt.

Relevant endpoints:

```text
POST /api/assets/fingerprint
POST /api/assets/check
POST /api/assets/finance
GET  /api/assets/audit?fingerprint=...
GET  /api/assets/audit/export?fingerprint=...&format=csv|json
GET  /api/demo/config
POST /api/demo/seed
```

## Scripts

| Command        | Description                       |
| -------------- | --------------------------------- |
| `pnpm dev`     | Dev servers for web + api (+ sdk) |
| `pnpm build`   | Build all packages and apps       |
| `pnpm db:up`   | Start Postgres via Docker Compose |
| `pnpm db:down` | Stop Postgres                     |
| `pnpm lint`            | Lint all packages                 |
| `pnpm contracts:test`  | Hardhat unit tests                |
| `pnpm contracts:compile` | Compile Solidity                |

## Stack

- **Frontend:** Next.js 16, TypeScript, Tailwind CSS 4, RainbowKit, wagmi, viem, TanStack Query, Zod
- **Backend:** NestJS 11, TypeORM, SQLite/PostgreSQL, class-validator
- **Contracts:** Hardhat, Solidity 0.8.24 (`EncumbranceRegistry`)
- **Shared:** `@repo/sdk` (fingerprint + types), Turborepo monorepo

## MVP roadmap

1. Asset fingerprint API + UI form — complete
2. Issuer / Lender / Compliance demo — complete
3. CVI party verification gate — complete
4. Compliance export + verified demo seed — complete
5. Encumbrance registry contract — complete (API dual-write next)
6. CVA mint gate and issued-asset lifecycle
