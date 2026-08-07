# LIEN — Judge Q&A

Concise technical answers. No hype.

### 1. How is this different from simply hashing an invoice?

A PDF hash changes when margins, metadata, or filename change. LIEN’s **Obligation ID** is an EIP-712 digest of **economic terms** (supplier, obligor, currency, face value, due date, references, jurisdiction, version, nonce). `evidenceRoot` is stored for audit but **excluded** from the identity hash.

### 2. What prevents someone from changing the PDF?

Changing the PDF changes `evidenceRoot` but **not** the Obligation ID if economic fields are unchanged. Financing is keyed by Obligation ID, so “new PDF, same claim” collides with the existing claim state.

### 3. What prevents a fake invoice from being registered first?

Registration alone is not financeable. The obligor must **EIP-712-confirm** the terms. Where Cleanverse is configured, supplier/obligor wallets need an active **A-Pass (CVI)**. Fake unilateral registration without obligor confirmation does not unlock reserve.

### 4. How do you know the debtor recognizes the obligation?

`ObligationRegistry.confirm` recovers the obligor address from an EIP-712 signature over the economic terms (domain-separated to chain + registry contract). Wrong signer → `InvalidObligorSignature`.

### 5. How is this different from MonetaGo or other duplicate-financing registries?

Classic duplicate-invoice registries often key on document identifiers or hashes and sit beside protocols. LIEN is an **on-chain control plane** that financing adapters call for **atomic reservation** so the second protocol fails **before funds move**, with a public state machine and independent protocol adapters.

### 6. How is LIEN different from Coven / Mordant / other hackathon duplicate-financing projects?

Emphasis on: (1) **economic** vs binary identity, (2) **obligor confirmation**, (3) **atomic** reserve→fund→activate in adapter contracts, (4) **two independent** protocol consumers, (5) Cleanverse as the identity/trust gate rather than inventing KYC.

### 7. What exactly does Cleanverse do?

In this build: **CVI / A-Pass** for participant eligibility on live registration paths; **CVA** issuance remains available on the issuer UI path. Cleanverse does **not** replace LienGuard’s encumbrance state machine.

### 8. Why couldn't this be built without Cleanverse?

You could build a pure on-chain mutex without identity. Cleanverse makes the demo **RWA-credible**: verified parties, not anonymous EOAs pretending to be Acme and Atlas. Core reservation logic is still independent of Cleanverse for local Hardhat tests.

### 9. Is LIEN a legally perfected lien registry?

**No.** LIEN provides **protocol-level encumbrance coordination** for integrated systems. Jurisdiction-specific perfection/registration remains external.

### 10. What happens after repayment?

Controller calls `discharge` (via Protocol `repay`). State → **Discharged**. Claim fields (controller, financing/repayment refs) remain queryable. History is not erased.

### 11. Can the asset be financed again after discharge?

**Yes**, when the registry still marks the obligation financeable and LienGuard allows a new reservation (demonstrated in Hardhat tests).

### 12. What happens if two protocols try to reserve simultaneously?

Contract-level exclusive transition: first successful `reserve` wins; second reverts with reservation conflict / emits `FinancingConflict`. Covered by competing-reservation tests.

### 13. What if financing fails after reservation?

Adapters use **atomic** `reserve → transfer → activate` in one transaction. If transfer fails, the whole call reverts and reservation does not stick. Standalone reservations support expiry recovery (`expireReservation`).

### 14. What if identity status changes?

Live paths re-check A-Pass at registration/finance gates when configured. On-chain claims already created remain subject to LienGuard state (identity off-chain status does not silently rewrite history).

### 15. Is the design cross-chain today or cross-protocol today?

**Cross-protocol today** (DemoFinanceA vs DemoFinanceB on one chain). Cross-chain extension can reuse the same Obligation ID model; not required for P0.

### 16. What is actually enforced on-chain?

- Canonical ID derivation  
- Obligor confirmation  
- Exclusive reserve / activate / discharge  
- Queryable claim status  
- Independent protocol adapters cannot double-fund the same exclusive claim  

### 17. How do you preserve privacy?

Only hashes/roots and economic fields needed for identity go on-chain. Full document bodies stay off-chain (demo stores content only in API/UI for the attack narrative).

### 18. Why is the economic obligation ID better than the PDF hash?

Because attackers can regenerate binaries. Economic fields are what lenders care about; binding identity there collapses “looks different, finances the same claim” attacks.

### 19. Can legitimate subordinate claims exist?

P0 models **exclusive** active encumbrance for the demo. Subordinate / multi-priority claims are a deliberate P1+ extension, not claimed in the winning demo.

### 20. What would production deployment require?

Audited contracts, key management, production Cleanverse credentials, real settlement assets (not `dUSDC`), operational monitoring of events, legal packaging for jurisdiction-specific perfection, and formal protocol onboarding for adapters.
