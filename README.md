# LIEN

> **Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world asset underneath them.**

LIEN is **on-chain encumbrance infrastructure for tokenized real-world assets**. It gives a verified invoice/receivable a **canonical Obligation ID**, requires **obligor confirmation**, and lets independent financing protocols **atomically reserve** that claim so a second financing attempt fails **before funds move**.

Built for the **Cleanverse RWA hackathon** (CVI identity + CVA asset paths).

---

## Problem

Different tokens or lending apps can each accept a “new” document for the **same** economic obligation (same supplier, obligor, face value, due date). Token double-spend protection does not stop that.

## Why document hashing is insufficient

| Approach | Weakness |
| --- | --- |
| Hash the PDF | Margins, metadata, filename → new hash, same claim |
| Siloed registry per app | Other protocols never see the claim |
| Check-then-fund off-chain | Race: two funders both “see clean” |

LIEN keys claims on **EIP-712 economic terms**. Evidence/document roots are stored for audit but **excluded** from the Obligation ID.

## Architecture

```text
Verified Supplier + Verified Obligor  (Cleanverse CVI / A-Pass)
              |
              v
     Canonical Obligation (EIP-712)
              |
              v
          LienGuard
         /    |    \
   Protocol A  B  …   independent adapters
```

| Contract | Role |
| --- | --- |
| `ObligationRegistry` | Canonical terms, obligor confirm, financeable check |
| `LienGuard` | Reserve → Activate → Discharge (+ expiry) |
| `DemoFinanceA` / `DemoFinanceB` | Independent finance adapters |
| `MockSettlementToken` | Labeled demo settlement (`dUSDC`) |

## State machine

```text
Verified ──reserve──► Reserved ──activate──► Encumbered ──discharge──► Discharged
    ▲                   │
    └──── expire ───────┘
```

Illegal transitions revert. Discharge retains claim history.

## Monorepo

```text
apps/
  web/        Next.js — home + attack demo (/demo) only
  api/        NestJS — /api/lien/* + Cleanverse adapters
  contracts/  Hardhat — LienGuard stack + tests
packages/
  sdk/        Public npm package `lien-sdk` (EIP-712, LienClient, ABIs, deployments)
```

**Integrator docs:** [`docs/INTEGRATOR.md`](./docs/INTEGRATOR.md) · **SDK README:** [`packages/sdk/README.md`](./packages/sdk/README.md)

Legacy fingerprint issuer/lender/compliance UI and `/api/assets` dual-write path have been removed.

## Setup

```bash
pnpm install
```

### 1) Local chain + deploy LienGuard stack

```bash
# Terminal A
cd apps/contracts && pnpm node

# Terminal B
cd apps/contracts && pnpm deploy:lienguard:local
# → apps/contracts/deployments/localhost-lienguard.json
```

### 2) API env

Copy `apps/api/.env.example` → `apps/api/.env` and set:

```bash
LIEN_ENABLED=true
LIEN_TRUST_MODE=demo          # demo = labeled CVI/CCP mocks; live = real Cleanverse
LIEN_RPC_URL=http://127.0.0.1:8545
LIEN_CHAIN_ID=31337
LIEN_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
LIEN_REGISTRY_ADDRESS=0x...   # from deploy json
LIEN_GUARD_ADDRESS=0x...
LIEN_PROTOCOL_A_ADDRESS=0x...
LIEN_PROTOCOL_B_ADDRESS=0x...
LIEN_TOKEN_ADDRESS=0x...
```

Optional Cleanverse (live CVI on non-seed register paths):

```bash
CLEANVERSE_BASE_URL=https://uatapi.cleanverse.com/api/cooperate
CLEANVERSE_API_ID=...
CLEANVERSE_API_KEY=...
DEMO_ATOKEN_ADDRESS=0xaC0893567D43C3E7e6e35a72803df05416C1f20D
```

### 3) Run apps

```bash
pnpm dev
# Web  http://localhost:3000
# API  http://localhost:3001/api
# Docs http://localhost:3001/api/docs
```

## Live participants (Sepolia wallets)

1. Deploy: `cd apps/contracts && pnpm deploy:lienguard:sepolia`  
   → `deployments/sepolia-lienguard.json`
2. Set API `LIEN_*` addresses + `LIEN_TRUST_MODE=live` + `LIEN_RPC_URL` (Sepolia)  
   and web `NEXT_PUBLIC_LIEN_*` (see `apps/web/.env.example`).
3. Open **http://localhost:3000/demo** → **Live participant mode**
4. Connect MetaMask on **Sepolia**
5. Supplier wallet: Prepare → Register  
6. Obligor wallet (switch account): Sign EIP-712  
7. Supplier or obligor: Confirm on-chain  
8. Finance Protocol A → Attack Protocol B (should fail if A succeeded)  
9. Repay & discharge  

Cleanverse CVI/CCP is enforced when `LIEN_TRUST_MODE=live` and credentials are set.

## Operator demo (Hardhat seed)

Still on `/demo` below the live panel: Seed → A → B → discharge for local rehearsals.

Race evidence: `cd apps/contracts && pnpm test`

## API (core)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/lien/status` | Stack readiness + trust mode |
| POST | `/api/lien/demo/seed` | Local Hardhat seed (Acme/Atlas) |
| POST | `/api/lien/preview-ids` | Dual-document same Obligation ID |
| GET | `/api/lien/obligations/:id` | Passport + claim status |
| GET | `/api/lien/obligations/:id/graph` | Claim graph nodes (P1) |
| GET | `/api/lien/obligations/:id/export?format=json\|csv` | Evidence pack (P1) |
| POST | `/api/lien/protocols/A\|B/finance` | Independent finance |
| POST | `/api/lien/protocols/A\|B/repay` | Discharge |
| POST | `/api/lien/demo/compliance-fail` | P1 compliance gate demo |
| POST | `/api/lien/demo/reservation-expiry` | P1 reserve → expire (Hardhat) |
| GET | `/api/lien/audit?obligationId=` | Append-only audit |
| POST | `/api/lien/obligations/:id/claims/subordinate` | P2 subordinate claim |
| POST | `/api/lien/xchain/post` / `consume` | P2 cross-chain mock |
| POST | `/api/lien/attestations/build` | P2 attestation adapters |
| GET | `/api/lien/analytics` | P2 audit analytics |

### Integrator SDK (`lien-sdk`)

```bash
npm install lien-sdk viem
```

```ts
import { LienClient, SEPOLIA_DEPLOYMENT, buildClaimGraph } from "lien-sdk";

const lien = new LienClient({
  publicClient,
  registryAddress: SEPOLIA_DEPLOYMENT.contracts.ObligationRegistry,
  guardAddress: SEPOLIA_DEPLOYMENT.contracts.LienGuard,
  chainId: SEPOLIA_DEPLOYMENT.chainId,
});
const status = await lien.status(obligationId);
```

Full guide: [`docs/INTEGRATOR.md`](./docs/INTEGRATOR.md) · package: [`packages/sdk/README.md`](./packages/sdk/README.md)

Publish (maintainers):

```bash
pnpm --filter lien-sdk build
cd packages/sdk && pnpm publish --access public --no-git-checks
```

## Tests

```bash
cd apps/contracts && pnpm test
```

Invariants covered: exclusive reservation, Protocol B zero fund movement, invalid obligor sig, discharge + refinance, expired reservation, material term → new ID, same economics different evidence → same ID.

## Security (summary)

- EIP-712 domain separation (name/version/chainId/verifyingContract)  
- Nonce single-use on register  
- Clearance/reservation one-shot (`consumed`)  
- Exclusive active claim per obligation  
- Custom errors + structured events (`FinancingConflict`)  

## Cleanverse

| Primitive | Use |
| --- | --- |
| CVI / A-Pass | Participant eligibility on live registration |
| CVA | Issuer path tokenized asset issuance (existing flow) |

Local attack demo seed **skips** CVI (Hardhat keys only). Production paths do not fake Cleanverse success.

## Limitations

- Not a legally perfected global lien registry  
- Protocol-level encumbrance for **integrated** systems  
- `dUSDC` is a **demo settlement substitute**  
- Cross-protocol P0; cross-chain is future extension  

## Pitch materials

- [`PITCH.md`](./PITCH.md) — 30s / 90s / 3min  
- [`JUDGE_QA.md`](./JUDGE_QA.md) — 20 judge questions  
- [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) — P0 matrix  
- [`LIEN_Winning_Edge_PRD.md`](./LIEN_Winning_Edge_PRD.md) — source of truth  
- [`docs/INTEGRATOR.md`](./docs/INTEGRATOR.md) — builder / integrator guide  
- [`docs/DEMO_SCRIPT.md`](./docs/DEMO_SCRIPT.md) — spoken demo script (live + operator fallback)  

## License

- Monorepo demo app: private hackathon submission unless otherwise noted.  
- **`lien-sdk`** (`packages/sdk`): MIT — see [`packages/sdk/LICENSE`](./packages/sdk/LICENSE).
