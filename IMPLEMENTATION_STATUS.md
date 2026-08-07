# LIEN — Implementation Status

Aligned to `LIEN_Winning_Edge_PRD.md` and `LIEN_Grok_OneShot_Implementation_Prompt.md`.

## P0 — complete

Canonical Obligation ID, obligor EIP-712, LienGuard exclusive lifecycle, dual protocols, CVI/CCP gates, audit, attack demo UI, tests (see git history).

## P1 — complete

| Item | Status |
| --- | --- |
| Audit export JSON/CSV | Done |
| Claim graph | Done |
| Reservation expiry demo | Done |
| Compliance failure demo | Done |
| Developer SDK (`LienClient`) | Done |

## P2 — complete

| Item | Status | Location |
| --- | --- | --- |
| **FR-15 Subordinate / priority claims** | **Done** | `PriorityClaimBook.sol` — ranks ≥1 disclosed juniors; rank 0 exclusive stays on LienGuard; **protocol-level only** disclaimer |
| **Cross-chain architecture mock** | **Done** | `CrossChainClearanceMock.sol` — post/consume hashed clearances; **not a bridge** |
| **Richer attestation adapters** | **Done** | `@repo/sdk` attestation adapters + `POST /lien/attestations/build` |
| **Extra asset classes** | **Done** | `asset-classes.ts` (invoice, warehouse_receipt, PO, equipment, private_credit) |
| **Generalized SDK** | **Done** | LienClient + asset classes + attestation + privacy |
| **Extra analytics** | **Done** | `GET /lien/analytics` |
| **Advanced privacy** | **Done** | `applyPrivacyFilter` + export `?privacy=redacted\|commitments_only` |

### P2 contracts

- `PriorityClaimBook`
- `CrossChainClearanceMock`

### P2 API

| Method | Path |
| --- | --- |
| GET | `/lien/obligations/:id/claims` |
| POST | `/lien/obligations/:id/claims/subordinate` |
| POST | `/lien/claims/:claimId/release` |
| POST | `/lien/xchain/post` |
| POST | `/lien/xchain/consume` |
| POST | `/lien/attestations/build` |
| GET | `/lien/analytics` |
| GET | `/lien/obligations/:id/export?privacy=` |

### Tests

Hardhat: **20 passing** (legacy + P0 + P2).

## Explicit non-claims

- Subordinate claims ≠ legally perfected multi-lien structure  
- Cross-chain mock ≠ production bridge or remote settlement  
- Privacy filter is export redaction, not ZK  

## Live participant mode (Sepolia)

| Item | Status |
| --- | --- |
| LienGuard stack on Sepolia | Deployed (`deployments/sepolia-lienguard.json`) |
| Wallet connect (RainbowKit / Sepolia) | Done |
| User register / obligor EIP-712 sign / confirm | Done (`LiveParticipantPanel` + `useLienWallet`) |
| User Protocol A/B finance + repay | Done (browser `writeContract`) |
| Live prepare + CVI check + client audit API | Done (`/lien/live/*`) |
| Operator Hardhat seed | Still available below live panel |

## Product surface

Web: `/` + `/demo` (live wallets first, operator seed second).  
API: `/api/lien/*` + Cleanverse proxy.
