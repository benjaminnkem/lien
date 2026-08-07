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
| FR-06 Reservation expiry | **Done** | `expireReservation` + tests |
| FR-07 Activation consumes reservation | **Done** | one-time `consumed` |
| FR-08 Protocol-bound one-time clearance | **Done** | `getClearance` + `ClearanceIssued` |
| FR-09 Status + reason codes | **Done** | SDK `LIEN_REASON_*` + API |
| FR-10 Discharge | **Done** | controller-only |
| FR-11 Append-only audit | **Done** | `lien_audit_events` + `/lien/audit` |
| FR-12 Two independent protocols | **Done** | DemoFinanceA / B |
| CVI integration | **Done** | `LienComplianceService` live or demo |
| CCP pre-tx check | **Done** | live `verifyUserCompliance`; demo labeled pass |
| CVA-protected funding path | **Done** | settlement rail metadata; dUSDC labeled substitute on local |
| Conflict UI | **Done** | `/demo` only |
| Invariant tests | **Done** | Hardhat 16 passing (race included) |
| Pitch / Judge Q&A / README | **Done** | root docs |
| Legacy fingerprint UI | **Removed** | `/issuer` `/lender` `/compliance` gone |

## Removed (legacy)

- Web: issuer, lender, compliance pages and related hooks/stores
- API modules unplugged from `AppModule`: `AssetsModule`, `DemoModule` (legacy seed), `ChainModule` (old EncumbranceRegistry dual-write)
- Product surface is **home + `/demo` + `/api/lien/*` + Cleanverse proxy**

## Trust modes

| Mode | When | Behavior |
| --- | --- | --- |
| `demo` | Hardhat default / `LIEN_TRUST_MODE=demo` | Labeled mock CVI/CCP — **not claimed as live Cleanverse** |
| `live` | Public chain + Cleanverse creds | Real A-Pass query/verify + CCP verify; fails closed |

## Definition of done

- Clean-state demo via `/demo` seed without DB hacks  
- Protocol B fails at contract layer; `fundsMoved: false`  
- Dual evidence → same Obligation ID  
- Race test in Hardhat suite  
- Trust gates visible in UI  
- Discharge preserves history + audit  
- No legal-perfection overclaim  

## Explicit non-P0

- DEFAULTED / DISPUTED workflows (enum only)
- Subordinate claims (P2)
- Cross-chain (P2)
- Foundry (Hardhat used equivalently)
- Monad testnet deploy (local Hardhat primary for now)
