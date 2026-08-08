# lien-sdk

TypeScript SDK for the **LIEN** protocol — on-chain encumbrance infrastructure for tokenized real-world assets (invoices / receivables).

> Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world claim underneath them.

## Install

```bash
npm install lien-sdk viem
# or
pnpm add lien-sdk viem
```

**Peer dependency:** [`viem`](https://viem.sh) `^2.21.0`

## What you get

| Module | Purpose |
| --- | --- |
| **Obligation helpers** | EIP-712 types, domain, signable terms, economic identity (evidence root excluded from ID) |
| **`LienClient`** | Read-oriented client: `obligationId`, `isFinanceable`, `status`, `getClearance` |
| **ABIs** | Minimal registry / guard / adapter ABIs for integrators |
| **Deployments** | Known public addresses (e.g. Sepolia) |
| **Attestation adapters** | Pluggable commitments for audit / export (not a substitute for on-chain confirm) |
| **Privacy helpers** | Redaction levels for evidence packs |
| **Claim graph / CSV** | Map audit events → graph nodes or CSV export |

## Quick start

```ts
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import {
  LienClient,
  SEPOLIA_DEPLOYMENT,
  evidenceRootFromBytes,
  eip712Domain,
  OBLIGATION_EIP712_TYPES,
  signableTerms,
  type ObligationTerms,
} from "lien-sdk";

const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

const { contracts, chainId } = SEPOLIA_DEPLOYMENT;

const lien = new LienClient({
  publicClient,
  registryAddress: contracts.ObligationRegistry,
  guardAddress: contracts.LienGuard,
  chainId,
});

// Build terms (evidenceRoot is stored but NOT part of Obligation ID)
const terms: ObligationTerms = {
  supplier: "0x…",
  obligor: "0x…",
  currency: "USD",
  faceValue: 100_000n,
  dueDate: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
  invoiceReference: "INV-001",
  purchaseOrderReference: "PO-001",
  evidenceRoot: evidenceRootFromBytes("invoice-pdf-bytes-or-string"),
  jurisdiction: "NG",
  version: 1n,
  nonce: "0x…", // unique bytes32
};

const obligationId = await lien.obligationId(terms);
const financeable = await lien.isFinanceable(obligationId);
const status = await lien.status(obligationId);
// status.stateLabel → "Verified" | "Reserved" | "Encumbered" | …
```

### EIP-712 obligor signing

```ts
import { privateKeyToAccount } from "viem/accounts";

const account = privateKeyToAccount("0x…");
const domain = eip712Domain({
  chainId,
  verifyingContract: contracts.ObligationRegistry,
});

const signature = await account.signTypedData({
  domain,
  types: OBLIGATION_EIP712_TYPES,
  primaryType: "ObligationTerms",
  message: signableTerms(terms),
});
```

### Check lien before financing

```ts
const st = await lien.status(obligationId);
if (st.stateLabel !== "Verified" && st.stateLabel !== "Discharged") {
  throw new Error(`Cannot finance: ${st.stateLabel}`);
}
if (!(await lien.isFinanceable(obligationId))) {
  throw new Error("Not financeable");
}
// Then call your adapter: reserve → fund → activate
```

## Sepolia deployment

```ts
import { SEPOLIA_DEPLOYMENT, getDeployment } from "lien-sdk";

SEPOLIA_DEPLOYMENT.contracts.LienGuard;
// 0x70451CFb4182537CeC9781910C5538e8EFCEFdF7

getDeployment(11155111); // same object, or undefined if unknown
```

Addresses are for integrator convenience — verify on the explorer / your env before production use.

| Contract | Role |
| --- | --- |
| `ObligationRegistry` | Canonical terms, obligor confirm, financeable check |
| `LienGuard` | Reserve → Activate → Discharge |
| `DemoFinanceA` / `DemoFinanceB` | Independent finance adapters (demo) |
| `MockSettlementToken` | Demo settlement (`dUSDC`) |
| `PriorityClaimBook` | Subordinate claims (P2) |
| `CrossChainClearanceMock` | Cross-chain clearance mock (not a bridge) |

Explorer: [sepolia.etherscan.io](https://sepolia.etherscan.io)

## State machine

```text
Verified ──reserve──► Reserved ──activate──► Encumbered ──discharge──► Discharged
    ▲                   │
    └──── expire ───────┘
```

Illegal transitions revert on-chain. A second concurrent reserve fails with a structured reason (e.g. reservation conflict / already encumbered).

## Design notes (integrators)

1. **Economic ID ≠ document hash** — Same supplier/obligor/face/due/refs/jurisdiction/version/nonce → same Obligation ID even if the PDF bytes differ. `evidenceRoot` is audit-only.
2. **Protocol-level exclusivity** — LIEN protects integrated adapters that call `LienGuard`. It is not a legally perfected global lien registry.
3. **Obligor confirmation** — EIP-712 signature + on-chain `confirm` is the primary attestation path. SDK attestation adapters are for export/audit commitments only.
4. **Demo vs live** — `dUSDC` and demo finance adapters are labeled substitutes. Do not treat them as production settlement rails.

## Full integrator guide

See the monorepo: [`docs/INTEGRATOR.md`](../../docs/INTEGRATOR.md) — architecture, wallet flow, API surface, and adapter checklist.

## API reference (exports)

```ts
// Core
LienClient, buildClaimGraph, auditEventsToCsv
ObligationTerms, OBLIGATION_EIP712_TYPES, eip712Domain, signableTerms
evidenceRootFromBytes, economicIdentityKey
lienStateLabel, LIEN_STATE_LABELS, LIEN_REASON_CODES, lienReasonLabel

// Chain data
SEPOLIA_DEPLOYMENT, DEPLOYMENTS, getDeployment
obligationRegistryAbi, lienGuardAbi
lienRegistryReadAbi, lienGuardReadAbi  // used internally by LienClient

// Attestation / privacy
EvidenceRootAdapter, SupplierStatementAdapter, …
applyPrivacyFilter, PrivacyLevel
```

## Versioning

- **0.1.x** — public testnet / hackathon surface. Expect minor additive changes.
- Follow [semver](https://semver.org): breaking EIP-712 field or ID rules will bump major.

## License

MIT

## Links

- Repo: [github.com/benjaminnkem/lien](https://github.com/benjaminnkem/lien)
- Demo: monorepo `apps/web` → `/demo`
- Contracts: monorepo `apps/contracts`
