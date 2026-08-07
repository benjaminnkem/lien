# LIEN — Pitch

## One-line pitch

> **Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world asset underneath them.**

## 30-second pitch

Token double-spend protection stops at the token boundary. The same real-world invoice can still quietly back two different loans or tokenized claims if each protocol only sees its own document hash.

LIEN gives a verified economic obligation a **canonical Obligation ID** (not a PDF hash), requires **obligor confirmation** via EIP-712, and lets financing protocols **atomically reserve** that claim before funds move. A second protocol attempting the same exclusive claim is rejected on-chain — **before settlement**.

## 90-second pitch

**Problem.** Receivables and invoices are being tokenized and financed across independent apps. File hashes and siloed registries do not stop “Document B” (same economics, different binary) from funding twice.

**Insight.** The identity that matters is the **economic obligation**: verified supplier, verified obligor, face value, currency, due date, references — not the PDF bytes.

**How LIEN works.**

1. Parties are identity-gated via **Cleanverse CVI (A-Pass)** where configured.
2. Terms are canonicalized; **evidenceRoot is stored but excluded from the Obligation ID**, so modified renders of the same claim collide on ID.
3. The obligor signs the economic terms (EIP-712).
4. **LienGuard** enforces `Verified → Reserved → Encumbered → Discharged`.
5. **DemoFinanceA** and **DemoFinanceB** are independent adapters. A funds; B is blocked with zero settlement movement.

**Demo moment.** Side-by-side: Document A hash ≠ Document B hash, Obligation ID A == Obligation ID B, Protocol B shows **BLOCKED BEFORE FUNDS MOVED**.

## 3-minute pitch

### Problem

RWA finance is multi-venue. Without a shared encumbrance control plane, exclusive claims on the same receivable can be minted or funded more than once.

### Insight

Prevent double-spend of the **underlying claim**, not only of the ERC-20/ERC-721 that wraps it.

### Architecture

```text
Verified Supplier + Verified Obligor (Cleanverse CVI)
              |
              v
   Canonical Obligation (EIP-712 terms)
              |
              v
         LienGuard
        /    |    \
   Protocol A  B  …  (independent adapters)
```

- **ObligationRegistry** — identity + confirmation
- **LienGuard** — atomic reserve / activate / discharge
- **DemoFinanceA/B** — independent financing + settlement
- **MockSettlementToken (dUSDC)** — labeled demo settlement substitute

### Attack demo

1. Seed Acme → Atlas, USD 100k, obligor confirmed  
2. Protocol A finances USD 80k → ENCUMBERED  
3. Protocol B uses Document B → same Obligation ID → rejected, liquidity unchanged  
4. Discharge → history retained; refinancing allowed when state permits  

### Cleanverse

CVI/A-Pass gates who may participate. CVA flows remain available in the issuer path for verified asset issuance. LIEN is the **encumbrance coordination layer** between financing protocols.

### Scalability

Any integrated protocol calls the same LienGuard surface. Cross-protocol today; cross-chain messaging can extend the same obligation identity later without changing the core thesis.

## Killer demo line

> **Ethereum and Monad can stop you from spending the same token twice. Until LIEN, nothing stopped you from creating two different tokens backed by the same invoice.**

## Claims we do **not** make

- LIEN is not a global legally perfected lien registry for every jurisdiction.
- LIEN provides **protocol-level encumbrance state / priority within integrated systems**.
- Demo settlement (`dUSDC`) is a **labeled test substitute**, not a production bank deposit.
