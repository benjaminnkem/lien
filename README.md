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

### Network: Ethereum Sepolia only

Lien’s demo is **testnet-only**:

| Layer | Network |
| --- | --- |
| Wallet / wagmi / RainbowKit | **Ethereum Sepolia** (`chainId` 11155111) |
| Cleanverse UAT API | Sandbox (`uatapi.cleanverse.com`) |
| Cleanverse `chain` field | **`ethereum`** (UAT maps this to Sepolia, not mainnet) |
| EncumbranceRegistry | **Ethereum Sepolia** |

Demo default settlement is Ethereum Sepolia (`DEMO_CHAIN=ethereum`). The
registry is **global by fingerprint**: financing on one network blocks the same
invoice on every other network (try Lender B on `DEMO_CONFLICT_CHAIN=base`).

### Cleanverse + browser wallets

Issuer and lender actions use the **wallet connected in the browser**
(RainbowKit / MetaMask). There is no server-side mock wallet for the live flow.

Server env only needs Cleanverse credentials and the public verification A-Token:

```bash
CLEANVERSE_BASE_URL=https://uatapi.cleanverse.com/api/cooperate
CLEANVERSE_API_ID=your-api-id
CLEANVERSE_API_KEY=your-api-key

DEMO_CHAIN=ethereum
DEMO_CONFLICT_CHAIN=base
DEMO_ATOKEN_ADDRESS=0xaC0893567D43C3E7e6e35a72803df05416C1f20D
```

Connect an account that already holds an active Cleanverse UAT A-Pass for the
selected network (`ethereum` = Sepolia in UAT). To run Lender A then Lender B,
**switch MetaMask accounts** between financing attempts. API id/key never go to
`apps/web`. Failed CVI checks return `CVI_*` codes and are audited.

## Five-minute judge path

1. Open `http://localhost:3000/issuer`. **Connect** the issuer MetaMask account
   (A-Pass on ethereum/Sepolia), submit the invoice, and see **CVI verified**
   plus **Registry clean**.
2. Continue to `/lender`, connect the **Lender A** wallet, open the invoice, and
   finance. The API runs `query_apass` / `verify_apass` on that address, then
   registers the global first lien (+ Sepolia dual-write when enabled).
3. Switch MetaMask to a **different** Lender B account, select the conflict
   network (default `base`), and retry. Registry responds `409` with
   `CROSS_CHAIN_REPLEDGE` (or same-network duplicate block).
4. Open `/compliance` for the audit trail and export CSV/JSON.

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
- **Contracts:** Hardhat, Solidity 0.8.24 (`EncumbranceRegistry` on Ethereum Sepolia)
- **Network:** Ethereum Sepolia only (Cleanverse UAT `chain: ethereum`)
- **Shared:** `@repo/sdk` (fingerprint + types), Turborepo monorepo

## MVP roadmap

1. Asset fingerprint API + UI form — complete
2. Issuer / Lender / Compliance demo — complete
3. CVI party verification gate — complete
4. Compliance export + verified demo seed — complete
5. Encumbrance registry contract + API dual-write on finance — complete
6. CVA mint gate and issued-asset lifecycle
