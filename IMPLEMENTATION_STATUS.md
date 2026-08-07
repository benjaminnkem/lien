# LIEN — Implementation Status

Aligned to `LIEN_Winning_Edge_PRD.md` and `LIEN_Grok_OneShot_Implementation_Prompt.md`.

## P0 checklist

| Item | Status | Notes |
| --- | --- | --- |
| FR-01 Canonical obligation | **Done** | EIP-712 terms; evidence excluded from ID |
| FR-02 Verified supplier | **Done** | CVI gate on register (live) / labeled demo-mock (Hardhat) |
| FR-03 Obligor confirmation | **Done** | EIP-712 confirm |
| FR-04 Evidence root | **Done** | Stored, queryable, not identity |
| FR-05 Atomic reserve | **Done** | LienGuard exclusive reservation |
| FR-06 Reservation expiry | **Done** | `expireReservation` + tests + P1 demo API |
| FR-07 Activation consumes reservation | **Done** | one-time `consumed` |
| FR-08 Protocol-bound one-time clearance | **Done** | `getClearance` + `ClearanceIssued` |
| FR-09 Status + reason codes | **Done** | SDK `LIEN_REASON_*` + API |
| FR-10 Discharge | **Done** | controller-only |
| FR-11 Append-only audit | **Done** | `lien_audit_events` + `/lien/audit` |
| FR-12 Two independent protocols | **Done** | DemoFinanceA / B |
| CVI / CCP / settlement rail | **Done** | `LienComplianceService` |
| Conflict UI | **Done** | `/demo` |
| Tests | **Done** | Hardhat 16 passing |
| Docs | **Done** | README, PITCH, JUDGE_QA |

## P1 checklist

| Item | Status | Location |
| --- | --- | --- |
| Audit export (JSON + CSV) | **Done** | `GET /lien/obligations/:id/export?format=json\|csv` |
| Claim graph polish | **Done** | `GET /lien/obligations/:id/graph` + UI timeline graph |
| Reservation expiry UI/demo | **Done** | `POST /lien/demo/reservation-expiry` + demo button |
| Compliance failure demo | **Done** | `POST /lien/demo/compliance-fail` + demo button |
| Developer SDK wrapper | **Done** | `@repo/sdk` `LienClient`, `buildClaimGraph`, `auditEventsToCsv` |

## Product surface

- Web: `/` + `/demo` only (legacy issuer/lender/compliance removed)
- API: `/api/lien/*` + Cleanverse proxy + health
- Contracts: ObligationRegistry, LienGuard, DemoFinanceA/B, MockSettlementToken

## Trust modes

| Mode | When | Behavior |
| --- | --- | --- |
| `demo` | Hardhat default / `LIEN_TRUST_MODE=demo` | Labeled mock CVI/CCP |
| `live` | Public chain + Cleanverse creds | Real A-Pass + CCP; fails closed |

## Out of scope (P2+)

- Subordinate / multi-priority claims
- Cross-chain architecture mock
- DEFAULTED / DISPUTED operator workflows
- Production bridge / marketplace / AI
