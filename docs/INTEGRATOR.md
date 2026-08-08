# LIEN Integrator Guide

How financing protocols, wallets, and off-chain systems integrate with **LIEN** — the on-chain encumbrance control plane for invoice/receivable RWAs.

> **Not legal advice.** LIEN provides protocol-level exclusive reservation for **integrated** systems. It is not a perfected statutory lien registry in every jurisdiction.

---

## 1. Why integrate

Without a shared control plane:

| Failure mode | Result |
| --- | --- |
| Hash the PDF | New margins/metadata → new hash, same economic claim |
| Per-app registry | Protocol B never sees Protocol A’s claim |
| Check-then-fund off-chain | Race: both funders see “clean” |

LIEN keys the claim on **EIP-712 economic terms**, requires **obligor confirmation**, and exposes **atomic reserve → activate → discharge** so a second finance attempt reverts **before funds move**.

---

## 2. Architecture

```text
Verified Supplier + Verified Obligor  (e.g. Cleanverse CVI / A-Pass)
              │
              v
     ObligationRegistry  ── canonical Obligation ID
              │
              v
          LienGuard
         /    |    \
   Your adapter  B  C   (independent protocols)
```

| Contract | Integrator surface |
| --- | --- |
| `ObligationRegistry` | `register`, `confirm`, `obligationId`, `isFinanceable` |
| `LienGuard` | `reserve`, `activate`, `discharge`, `status`, `getClearance` |
| Your adapter | Calls guard around your fund/repay logic |

SDK package: **`lien-sdk`** (npm) — TypeScript helpers, `LienClient`, ABIs, Sepolia addresses.

```bash
npm install lien-sdk viem
```

Full package docs: [`packages/sdk/README.md`](../packages/sdk/README.md)

---

## 3. Canonical obligation identity

### Terms

```ts
type ObligationTerms = {
  supplier: Address;
  obligor: Address;
  currency: string;           // e.g. "USD"
  faceValue: bigint;
  dueDate: number;            // unix seconds
  invoiceReference: string;
  purchaseOrderReference: string;
  evidenceRoot: Hex;          // stored; NOT in identity hash
  jurisdiction: string;
  version: bigint;
  nonce: Hex;                 // bytes32, single-use on register
};
```

### Rules

1. **Identity excludes `evidenceRoot`** — two different document binaries can share one Obligation ID if economic fields match.
2. **EIP-712 primary type** is `ObligationTerms` without `evidenceRoot` (see `OBLIGATION_EIP712_TYPES` in the SDK).
3. **Domain:** name `LIEN ObligationRegistry`, version `1`, `chainId`, `verifyingContract` = registry address.
4. **Nonce** is consumed on successful register — do not reuse.

### Off-chain helpers

```ts
import {
  evidenceRootFromBytes,
  economicIdentityKey,
  eip712Domain,
  OBLIGATION_EIP712_TYPES,
  signableTerms,
} from "lien-sdk";
```

---

## 4. Lifecycle (happy path)

```text
1. Supplier prepares terms + evidenceRoot
2. Supplier register(terms) on ObligationRegistry
3. Obligor signs EIP-712 (wallet)
4. Supplier or obligor confirm(terms, signature)
5. State → Verified; isFinanceable = true
6. Protocol A reserve(obligationId, amount, expiry)
7. Protocol A funds user / vault
8. Protocol A activate(reservationId, financingRef)
9. State → Encumbered
10. Later: Protocol A discharge(obligationId, repaymentRef)
11. State → Discharged (history retained; refinance possible with new economics/nonce as designed)
```

### State machine

```text
Verified ──reserve──► Reserved ──activate──► Encumbered ──discharge──► Discharged
    ▲                   │
    └──── expire ───────┘
```

Other states (Cancelled, Defaulted, Disputed) exist for ops paths — treat unknown states as non-financeable.

---

## 5. Adapter checklist (your financing protocol)

Implement an adapter contract (or backend + wallet txs) that:

### Before funding

1. Read `LienGuard.status(obligationId)` — expect financeable state (typically **Verified**, or your policy for re-finance after discharge).
2. Read `ObligationRegistry.isFinanceable(obligationId)`.
3. Call `LienGuard.reserve(obligationId, financingAmount, expiry)` — **reverts** if another active reservation/encumbrance exists.
4. Capture `reservationId` and clearance (`getClearance`).
5. Only then transfer funds / mint / book the loan.

### After funding succeeds

6. Call `activate(reservationId, financingRef)` so state becomes **Encumbered** and clearance is consumed.

### On repayment

7. Call `discharge(obligationId, repaymentRef)`.

### On reserve without activate

8. Let reservation **expire**, or your product policy may cancel — expired reserve returns capacity to Verified for a later attempt.

### Do not

- Fund first, then reserve (race window).
- Copy PDF hashes as the only uniqueness key.
- Assume LIEN replaces legal perfection, KYC, or credit underwriting.

### Reason codes (machine-readable)

SDK: `LIEN_REASON_CODES` / `lienReasonLabel` — e.g. reservation conflict, already encumbered, not verified. Surface these in your UI and audit log.

---

## 6. Read path with `LienClient`

```ts
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { LienClient, SEPOLIA_DEPLOYMENT } from "lien-sdk";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.RPC_URL),
});

const d = SEPOLIA_DEPLOYMENT;
const lien = new LienClient({
  publicClient,
  registryAddress: d.contracts.ObligationRegistry,
  guardAddress: d.contracts.LienGuard,
  chainId: d.chainId,
});

const id = await lien.obligationId(terms);
const ok = await lien.isFinanceable(id);
const st = await lien.status(id);
// st.stateLabel, st.claimController, st.securedAmount, st.reservedUntil, …
```

For writes, use `obligationRegistryAbi` / `lienGuardAbi` from `lien-sdk` with `walletClient.writeContract`, or call your own adapter.

---

## 7. Public testnet (Sepolia)

```ts
import { SEPOLIA_DEPLOYMENT, getDeployment } from "lien-sdk";

// chainId 11155111
SEPOLIA_DEPLOYMENT.contracts;
```

| Contract | Address (verify on explorer) |
| --- | --- |
| ObligationRegistry | `0xD7cB2f67434eFfa6e78eaed221C71E9Bd5500f9C` |
| LienGuard | `0x70451CFb4182537CeC9781910C5538e8EFCEFdF7` |
| MockSettlementToken | `0x79037a0722985B2E2Cf66ADba9ebf6937d67123C` |
| DemoFinanceA | `0xDffB1Ba961a1e13c5D4955DdA2FeC6C93dbAbCcF` |
| DemoFinanceB | `0xaFBC2BB2396A66720Bea47933e2a38E01e34da70` |
| PriorityClaimBook | `0xf94295CD7CcF71A40b17511cA489374c61A02973` |
| CrossChainClearanceMock | `0xd460cF41d4EB8EA8e1529Ed9785926dD9e7c8CD1` |

Demo adapters use **dUSDC** (`MockSettlementToken`) — labeled demo settlement, not production USDC.

---

## 8. Optional: LIEN HTTP API (this monorepo)

The NestJS API under `apps/api` wraps registry/guard for the hackathon demo. Useful for:

- Obligation passport + audit trail  
- Claim graph / CSV evidence export  
- Demo seed, compliance-fail, expiry demos  
- Attestation build helpers  

Base path: `/api/lien/*` (Swagger: `/api/docs` when running).

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/lien/status` | Stack readiness + trust mode |
| GET | `/lien/obligations/:id` | Passport + claim status |
| GET | `/lien/obligations/:id/graph` | Claim graph nodes |
| GET | `/lien/obligations/:id/export?format=json\|csv` | Evidence pack |
| POST | `/lien/protocols/A\|B/finance` | Demo independent finance |
| POST | `/lien/protocols/A\|B/repay` | Discharge |
| GET | `/lien/audit?obligationId=` | Append-only audit |

**Production integrators** should prefer **direct contract calls + `lien-sdk`** and treat the HTTP API as a reference implementation / ops layer, not a required dependency.

Trust modes:

- `LIEN_TRUST_MODE=demo` — labeled CVI/CCP mocks for local demo  
- `LIEN_TRUST_MODE=live` — real Cleanverse CVI where configured  

---

## 9. Cleanverse (identity)

When running **live** registration paths:

| Primitive | Role |
| --- | --- |
| CVI / A-Pass | Participant eligibility (supplier/obligor) |
| CVA | Separate tokenized asset issuance path |

Local Hardhat seed skips CVI. Do not fake Cleanverse success in production paths.

---

## 10. Privacy & attestations (SDK)

- **On-chain** stores roots/hashes, not full PDFs.  
- **`applyPrivacyFilter(data, level)`** — `public` | `redacted` | `commitments_only` for exports.  
- **Attestation adapters** (`EvidenceRootAdapter`, etc.) produce commitments for audit packs; they **do not** replace on-chain EIP-712 obligor confirmation.

---

## 11. Claim graph & evidence export

```ts
import { buildClaimGraph, auditEventsToCsv } from "lien-sdk";

const nodes = buildClaimGraph(auditRows);
const csv = auditEventsToCsv(auditRows);
```

Use for obligation passport UIs and dispute support packs.

---

## 12. Security summary

- EIP-712 domain separation (name / version / chainId / verifyingContract)  
- Nonce single-use on register  
- Clearance/reservation one-shot (`consumed`)  
- Exclusive active claim per obligation  
- Structured failures (`FinancingConflict`, reason codes)  

Always verify contract addresses and bytecode on the target chain before mainnet capital.

---

## 13. Limitations (say this in product copy)

- Not a legally perfected global lien registry  
- Protects **integrated** protocols that call `LienGuard`  
- Demo settlement token is a substitute  
- Cross-chain module in this repo is a **clearance mock**, not a bridge  
- No overclaim of “legal lien perfection” without counsel  

---

## 14. Reference demo

1. Deploy / use Sepolia addresses from `SEPOLIA_DEPLOYMENT`.  
2. Open monorepo web **`/demo`** → Live participant mode.  
3. Connect wallets on Sepolia: prepare → register → obligor sign → confirm → finance A → attack B (should fail) → repay.  

Contract tests: `cd apps/contracts && pnpm test`  
Invariants: exclusive reservation, B zero fund movement on conflict, invalid obligor sig, discharge, expired reservation, material term → new ID, same economics different evidence → same ID.

---

## 15. Publishing / versioning (maintainers)

```bash
# From monorepo root
pnpm install
pnpm --filter lien-sdk build
cd packages/sdk
# npm login  # once
pnpm publish --access public --no-git-checks
# or: pnpm run publish:npm
```

- Package name: **`lien-sdk`**  
- `prepublishOnly` runs `build`  
- Peer: `viem@^2.21.0`  
- Bump `version` in `packages/sdk/package.json` for each release  

---

## Related docs

| Doc | Content |
| --- | --- |
| [`packages/sdk/README.md`](../packages/sdk/README.md) | npm package README |
| [`README.md`](../README.md) | Monorepo setup + API table |
| [`apps/contracts/README.md`](../apps/contracts/README.md) | Hardhat deploy |
| [`docs/RENDER_DEPLOY.md`](./RENDER_DEPLOY.md) | Hosted API deploy |
| [`PITCH.md`](../PITCH.md) | Narrative |
| [`LIEN_Winning_Edge_PRD.md`](../LIEN_Winning_Edge_PRD.md) | Product source of truth |
