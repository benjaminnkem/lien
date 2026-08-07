# LIEN — One-Shot Full Implementation Prompt

You are the lead protocol engineer, smart-contract engineer, backend engineer, frontend engineer, security reviewer, QA engineer, and hackathon delivery owner for **LIEN**.

Your task is to **read the entire LIEN PRD from beginning to end and implement the product end-to-end in this repository**.

The PRD is the source of truth:

**`LIEN_Winning_Edge_PRD.md`**

Do not skim it. Do not implement from this prompt alone. Read the full PRD first, including the architecture, state machine, threat model, demo flow, invariants, scope priorities, judging strategy, UX requirements, pitch requirements, and ship checklist.

The objective is not to create a prototype-shaped codebase. The objective is to produce the **strongest working hackathon submission possible** within the constraints of the PRD.

---

## 1. Core Product Thesis

LIEN is **on-chain encumbrance infrastructure for tokenized real-world assets**.

The key idea is:

> **Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world asset underneath them.**

The product must prove that an underlying economic obligation cannot be financed twice across independent integrated protocols.

The winning implementation must center on these three properties:

1. **Canonical Economic Obligation Identity**
   - Identify the real economic obligation, not merely a PDF or file hash.
   - Two differently rendered documents representing the same verified obligation must resolve to the same canonical Obligation ID when the canonical economic fields are the same.
   - The obligor/debtor confirmation flow described in the PRD must be implemented where required.

2. **Atomic Reservation / Encumbrance**
   - Never use an unsafe `check -> later mint/fund -> later register` flow.
   - Reservation must be atomic.
   - Once one financing protocol reserves an obligation, another protocol attempting to reserve the same exclusive obligation must fail immediately.
   - Implement the exact lifecycle/state-machine behavior specified in the PRD.

3. **Cross-Protocol Enforcement**
   - LIEN must be infrastructure consumed by at least **two independent financing protocol adapters / demo applications / contracts**.
   - The demo must prove that Protocol A can finance a clean obligation while Protocol B is blocked from financing the same underlying obligation.
   - The second attempt must be blocked **before funds move**.

---

# 2. Operating Rules

Follow these rules for the entire task.

### Do not stop to ask me questions unless the task is literally impossible without a missing secret or credential.

When details are ambiguous:

1. Prefer the PRD.
2. Prefer the simplest secure architecture.
3. Prefer deterministic behavior over cleverness.
4. Prefer working P0 functionality over speculative P1/P2 functionality.
5. Make a reasonable engineering decision and document it.

Do not wait for approval after planning.

Do not only explain what should be built.

**Build it.**

Do not produce placeholder-only implementations for critical P0 functionality.

Do not fake successful Cleanverse calls.

If a real external API cannot be exercised because credentials are absent:

- implement the production adapter/interface cleanly;
- support environment variables;
- provide a deterministic local/mock adapter only for development/demo;
- clearly distinguish mocked behavior from real integration;
- never claim the mock is the live Cleanverse system.

Do not spend time on unnecessary AI, tokenomics, DAO governance, yield optimization, ZK systems, cross-chain bridges, or unrelated DeFi features unless the PRD explicitly makes them P0.

---

# 3. First Step — Read Before Coding

Before making changes:

1. Read **every section** of `LIEN_Winning_Edge_PRD.md`.
2. Inspect the entire repository:
   - current contracts;
   - frontend;
   - backend;
   - package managers;
   - config;
   - tests;
   - deployment scripts;
   - existing Cleanverse integration;
   - environment variable examples;
   - README;
   - git status.
3. Identify what already exists and preserve useful working code.
4. Map the existing codebase against PRD requirements.
5. Create an internal implementation checklist organized as:
   - P0 — must ship;
   - P1 — ship only after P0 is stable;
   - P2 — only if time remains.

Then immediately begin implementation.

Do not give me the checklist and wait.

---

# 4. P0 — Winning Hackathon Scope

Unless the PRD explicitly says otherwise, prioritize these capabilities above everything else.

## A. Canonical Obligation Model

Implement a canonical obligation representation containing the economically relevant fields specified by the PRD, such as the appropriate combination of:

- verified supplier/originator identity;
- verified buyer/debtor/obligor identity;
- invoice/obligation reference;
- purchase-order/reference data if applicable;
- currency;
- face value;
- due date;
- evidence/document root;
- nonce/version/domain-separation data;
- chain/protocol context where appropriate.

Canonicalization must be deterministic.

Hashing must use a clearly specified encoding with domain separation.

Avoid naive string concatenation.

Document the exact canonicalization rules.

The system must make it possible to demonstrate:

- Document A hash != Document B hash
- but Canonical Obligation ID A == Canonical Obligation ID B

when the documents represent the same verified economic claim.

## B. Obligor Confirmation

Implement the obligor/debtor confirmation mechanism from the PRD.

Where signatures are required:

- use EIP-712 typed structured data;
- protect against replay;
- bind signatures to the intended obligation;
- include chain/domain separation;
- validate signer identity/authority as designed.

The system must distinguish:

> “This file exists”

from:

> “This verified obligor acknowledges this economic obligation.”

## C. LIEN Registry / State Machine

Implement the PRD state machine faithfully.

At minimum support the required states and transitions around:

- unregistered/unseen;
- verified;
- reserved;
- encumbered;
- discharged;

plus any P0 dispute/cancel/default state explicitly required by the PRD.

Critical properties:

- illegal transitions revert;
- transitions emit structured events;
- history is never silently erased;
- discharge does not delete provenance;
- active encumbrance status is queryable;
- reservations expire safely if the PRD specifies expiration;
- unauthorized callers cannot mutate claims.

## D. Atomic Reservation

This is a critical winning feature.

Implement reservation so that two financing protocols cannot both successfully obtain an exclusive active reservation over the same obligation.

The implementation must be race-safe at the smart-contract state transition level.

The demo/test suite must include competing attempts such that:

- first valid reservation succeeds;
- second conflicting reservation fails deterministically.

Avoid UI-only locking.

Avoid off-chain mutex assumptions.

## E. Lien Clearance

Implement the clearance mechanism specified in the PRD.

A clearance should be:

- tied to a specific obligation;
- tied to the intended protocol/financing action when required;
- time/block bounded if specified;
- nonce/replay protected;
- one-time consumable;
- impossible to consume twice;
- impossible to reuse for another obligation;
- impossible to use after expiry.

If the PRD specifies signed clearances or clearance records, implement them exactly and securely.

## F. Encumbrance Activation

Once the financing action completes, reservation must become an active encumbrance.

The final active claim should expose enough information for another protocol to understand:

- that a conflicting financing already exists;
- current claim state;
- financing reference;
- relevant amount/priority fields;
- controller/protocol identity where appropriate;
- timestamps/block numbers.

## G. Discharge

Implement repayment/release/discharge.

After valid discharge:

- the active lien is no longer blocking where the PRD permits refinancing;
- historical evidence remains visible;
- the system must never pretend the obligation was never previously financed.

## H. Two Independent Protocol Integrations

This is mandatory for the winning demo.

Create two separate protocol consumers, e.g.:

- `ProtocolA` / `InvoiceFinanceA`
- `ProtocolB` / `InvoiceFinanceB`

They must each integrate with LIEN independently.

Do not implement two buttons that call the exact same UI method and pretend they are separate protocols.

At minimum they should be distinct contracts/adapters or distinct financing modules using the LIEN interface.

Required behavior:

### Protocol A

1. obtains/reserves valid clearance;
2. finances obligation;
3. activates encumbrance;
4. moves the demo settlement asset if required.

### Protocol B

1. tries to finance the same economic obligation;
2. attempts its own valid reservation;
3. is rejected because the asset is already reserved/encumbered;
4. never moves funds.

## I. Cleanverse Integration

Implement Cleanverse as a load-bearing trust layer, following the PRD.

Use the real interfaces/APIs/contracts available in the existing repo/docs for:

- CVI participant verification;
- CVA asset/settlement flows where required;
- CCP/pre-transaction compliance where required;
- audit/report data if available.

Important:

- do not invent unsupported Cleanverse behavior;
- do not equate identity verification with creditworthiness;
- do not claim LIEN itself legally perfects a security interest in every jurisdiction;
- use careful terminology such as **protocol-level encumbrance state / priority within integrated systems** where appropriate.

Structure the integration cleanly behind adapters/interfaces so the core LIEN state machine is testable.

## J. Demo Asset / Settlement

Use the narrowest credible hackathon asset flow specified by the PRD.

The preferred demonstration should make the financing leg tangible.

If a Cleanverse sandbox settlement asset is available, use it.

Otherwise implement the exact development/test substitute described by the PRD and clearly label it.

---

# 5. Smart Contract Requirements

Use the repo’s existing Solidity framework if present.

If none exists, prefer Foundry for contracts/tests unless repository constraints strongly favor Hardhat.

Contracts must:

- use explicit custom errors;
- emit rich events;
- use access control deliberately;
- follow checks-effects-interactions;
- defend against replay;
- defend against reentrancy where external calls exist;
- avoid unbounded loops in critical state-changing paths;
- use deterministic identifiers;
- include version/domain separation;
- use safe token transfer libraries where applicable;
- avoid unnecessary upgradeability for the hackathon unless already architected.

Produce a clean reusable interface for LIEN, approximately reflecting the PRD’s intended surface, such as:

- register/verify obligation;
- reserve;
- activate;
- discharge;
- cancel/expire if required;
- query status;
- query claim;
- query history / events.

Do not blindly copy a sample interface from the PRD if a safer implementation requires different signatures, but preserve its semantics.

---

# 6. Security / Invariant Test Suite

Implement automated tests.

At minimum, include the PRD invariants.

The suite should prove properties equivalent to:

1. **At most one conflicting exclusive active reservation/claim can exist for one Obligation ID.**
2. **A clearance cannot be consumed twice.**
3. **Two competing reservations cannot both succeed.**
4. **An encumbered asset cannot receive another conflicting financing claim.**
5. **Only an authorized controller can discharge the claim.**
6. **After valid discharge, the asset becomes financeable again when permitted.**
7. **Changing the raw document binary does not change the canonical Obligation ID when the verified economic obligation is unchanged.**
8. **Changing a material economic term does change the Obligation ID.**
9. **Invalid or replayed obligor signatures fail.**
10. **Expired reservations/clearances fail safely.**
11. **A failed Protocol B financing attempt moves zero settlement funds.**
12. **State transitions cannot skip required lifecycle states.**

Use:

- unit tests;
- fuzz tests;
- invariant/stateful tests where useful.

Do not stop at happy-path tests.

Run the complete suite and fix failures.

---

# 7. Threat Model

Implement defenses for the threats identified in the PRD.

At minimum think through and test:

- same obligation uploaded with a different PDF;
- modified file metadata;
- replayed obligor signature;
- changed economic field;
- duplicate financing from another protocol;
- concurrent reservation race;
- stale clearance;
- double consumption;
- unauthorized discharge;
- front-running where relevant;
- malformed identifiers;
- identity/compliance failure;
- reservation griefing;
- expired reservations;
- failed funding after reservation;
- settlement failure between reserve and activate;
- history tampering assumptions;
- denial-of-service vectors.

If there is a critical scenario where atomicity across LIEN + external settlement cannot be guaranteed in one transaction, implement the safest explicit state machine and recovery path possible and document the tradeoff.

---

# 8. Frontend Requirements

The UI must be demo-first.

Do not build a generic admin SaaS dashboard.

The product should visually communicate:

> one underlying economic obligation → one canonical identity → one encumbrance history → conflicting financing blocked.

Implement the key PRD screens.

## Required Demo View

Show:

- verified supplier;
- verified obligor;
- obligation reference;
- face value;
- due date;
- raw document hash;
- canonical Obligation ID;
- current LIEN state;
- current active claim;
- financing protocol;
- timeline/history.

## Required Side-by-Side Attack Flow

The demo must make it easy to show two independent financing protocols.

Example:

### Protocol A

- upload/choose Document A;
- verify;
- canonicalize;
- finance;
- success.

### Protocol B

- upload/choose visually modified Document B;
- raw document hash is different;
- canonical Obligation ID is the same;
- financing attempt;
- blocked before funds move.

Make the rejection visually unmistakable.

Suggested messaging:

**BLOCKED BEFORE FUNDS MOVED**

Reason:
**ACTIVE ENCUMBRANCE DETECTED**

Display the existing claim data.

## Asset Claim Graph

Implement the PRD’s asset/claim graph or an equally clear visualization.

The user/judge should be able to see:

- obligation;
- successful financing;
- rejected duplicate attempt;
- repayment;
- discharge.

Keep the UI polished, fast, and deterministic.

Avoid unnecessary animations that create demo risk.

---

# 9. Backend / Indexing

Only build backend infrastructure that materially helps the demo/product.

If indexing is needed:

- consume contract events;
- expose obligation history;
- expose claim history;
- expose verification/clearance records;
- persist only what is necessary.

Do not move authoritative encumbrance state into a centralized database.

The blockchain contract must remain the authoritative enforcement source for P0.

If documents/evidence need storage:

- store content hashes / roots on-chain;
- keep large binary content off-chain;
- do not put private sensitive document contents directly on-chain.

---

# 10. Exact Demo Scenario to Make Work

Implement a deterministic seeded/demo scenario matching the PRD.

The winning path should be executable repeatedly.

### Step 1 — Verified Obligation

Create:

- Supplier: `Acme Ltd`
- Buyer/Obligor: `Atlas Corp`
- Invoice/obligation: `$100,000`
- Due date: deterministic demo date

Obligor confirms the economic obligation.

System derives canonical Obligation ID.

### Step 2 — Protocol A Finances

Protocol A:

- obtains valid LIEN clearance/reservation;
- funds e.g. `$80,000` in demo settlement asset;
- activates encumbrance.

UI shows:

- ACTIVE / ENCUMBERED
- protocol;
- amount;
- tx reference;
- claim history.

### Step 3 — Attack from Protocol B

Generate/use a second document representing the same economic claim but with a different:

- filename;
- formatting;
- binary content;
- metadata.

Show:

**Document Hash A != Document Hash B**

Then show:

**Canonical Obligation ID A == Canonical Obligation ID B**

Protocol B attempts financing.

It must be blocked on-chain before settlement.

Show that Protocol B’s funding balance did not move.

### Step 4 — Race Test

Provide either a visible test/demo action or automated test evidence showing two near-simultaneous reservations where only one succeeds.

### Step 5 — Discharge

Repay/release Protocol A claim.

Transition:

**ENCUMBERED -> DISCHARGED**

History remains visible.

If the PRD permits re-financing after discharge, demonstrate that a new legitimate reservation can now succeed.

---

# 11. UX Copy

Use precise language.

Prefer:

- Verified Obligation
- Canonical Obligation ID
- Reservation
- Active Encumbrance
- Protocol-Level Claim
- Discharged
- Clearance Consumed
- Duplicate Financing Blocked
- Conflicting Claim Detected

Avoid unsupported legal claims such as:

- “legally perfected first lien worldwide”
- “guaranteed legal ownership”
- “globally legally binding lien”

Where necessary, add concise disclaimer copy explaining that LIEN provides shared protocol-level encumbrance coordination for integrated systems and does not independently replace jurisdiction-specific perfection/registration requirements.

---

# 12. Documentation Requirements

Update/create the README so a judge can understand the product quickly.

README must include:

## What LIEN Is

Use the core line:

> **Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world asset underneath them.**

## Problem

Explain why different tokens/contracts can otherwise be minted against the same underlying obligation.

## Why Existing Document Hashing Is Insufficient

Explain economic obligation identity vs binary file identity.

## Architecture

Diagram:

```text
Verified Supplier + Verified Obligor
              |
              v
     Canonical Obligation
              |
              v
        LIEN Registry
        /     |      \
       /      |       \
Protocol A Protocol B Protocol C
```

Show where Cleanverse CVI/CVA/CCP fit.

## State Machine

Document all states and legal transitions.

## Contracts

Explain every major contract.

## Demo

Provide exact commands and click sequence.

## Security

List invariants and threat defenses.

## Cleanverse

Explain exactly which Cleanverse primitives are used and why they are necessary.

## Limitations

Be explicit about legal-jurisdiction limitations and any mock/sandbox components.

## Setup

Provide exact:

- install;
- env;
- build;
- test;
- deploy;
- frontend run;
- demo seed commands.

A judge should be able to run it without guessing.

---

# 13. Hackathon Pitch Assets

Implement the product first, then produce/update pitch material in the repository.

Create:

**`PITCH.md`**

It must contain:

## One-line pitch

> **Blockchains prevent double-spending of tokens. LIEN prevents double-spending of the real-world asset underneath them.**

## 30-second pitch

Explain:

- blockchain double-spend protection stops at the token;
- a real invoice/receivable can still secretly back two different tokens/loans;
- LIEN gives the economic obligation a canonical verified identity;
- financing protocols atomically reserve the claim before funding;
- conflicting financing is blocked before money moves.

## 90-second pitch

Cover:

- real-world problem;
- why hash registries alone are insufficient;
- Cleanverse;
- canonical obligation;
- atomic reservation;
- cross-protocol enforcement;
- demo moment.

## 3-minute pitch

Include:

- problem;
- insight;
- architecture;
- attack demo;
- Cleanverse integration;
- scalability.

## Killer Demo Line

Include:

> **Ethereum and Monad can stop you from spending the same token twice. Until LIEN, nothing stopped you from creating two different tokens backed by the same invoice.**

Use only claims the actual implementation supports.

---

# 14. Judge Q&A

Create:

**`JUDGE_QA.md`**

Prepare concise answers to at least:

1. How is this different from simply hashing an invoice?
2. What prevents someone from changing the PDF?
3. What prevents a fake invoice from being registered first?
4. How do you know the debtor recognizes the obligation?
5. How is this different from MonetaGo or other duplicate-financing registries?
6. How is LIEN different from Coven / Mordant / other hackathon duplicate-financing projects?
7. What exactly does Cleanverse do?
8. Why couldn't this be built without Cleanverse?
9. Is LIEN a legally perfected lien registry?
10. What happens after repayment?
11. Can the asset be financed again after discharge?
12. What happens if two protocols try to reserve simultaneously?
13. What if financing fails after reservation?
14. What if identity status changes?
15. Is the design cross-chain today or cross-protocol today?
16. What is actually enforced on-chain?
17. How do you preserve privacy?
18. Why is the economic obligation ID better than the PDF hash?
19. Can legitimate subordinate claims exist?
20. What would production deployment require?

Answers must be technically precise and avoid hype.

---

# 15. Scope Discipline

P0 must be excellent before P1.

### P0

Must work end-to-end:

- canonical obligation;
- obligor confirmation;
- Cleanverse verification adapter;
- registry;
- atomic reservation;
- activation;
- discharge;
- clearance replay protection;
- two independent protocol integrations;
- attack demo;
- UI;
- automated tests;
- README;
- deploy/run scripts.

### P1

Only after P0 is stable:

- claim graph improvements;
- reservation expiry automation;
- richer audit export;
- multiple legitimate claim priority classes if the PRD calls for them;
- better indexed history;
- additional Cleanverse reporting.

### P2

Only if everything else is complete:

- generalized SDK;
- extra asset types;
- cross-chain architecture demonstration;
- extra analytics;
- advanced privacy.

Do not jeopardize P0 for P1/P2.

---

# 16. Repository Quality

By completion:

- no critical TODOs in P0 paths;
- no dead demo buttons;
- no fake success states;
- no broken imports;
- no knowingly failing tests;
- no secrets committed;
- `.env.example` included;
- deterministic demo seed data included;
- contract addresses configurable;
- ABI generation automated;
- error states handled;
- loading states handled;
- README commands verified.

Keep commits/code organization logical if git history is being used.

---

# 17. Validation Loop

Do not stop after implementation.

Perform the following loop:

1. build contracts;
2. run unit tests;
3. run fuzz/invariant tests;
4. deploy locally/testnet as available;
5. run backend;
6. run frontend;
7. execute complete demo;
8. intentionally execute duplicate-financing attack;
9. verify Protocol B moves zero funds;
10. execute discharge;
11. rerun tests;
12. inspect console/build logs;
13. fix errors;
14. repeat until stable.

Also review the implementation against every P0 requirement in the PRD.

---

# 18. Final Deliverables

Before finishing, ensure the repository contains all applicable deliverables:

- production-quality Solidity contracts;
- interfaces/adapters;
- Cleanverse integration;
- two protocol consumers;
- test suite;
- fuzz/invariant tests;
- deployment scripts;
- seeded deterministic demo;
- frontend;
- backend/indexer if needed;
- `.env.example`;
- `README.md`;
- `PITCH.md`;
- `JUDGE_QA.md`;
- architecture documentation/diagram;
- final demo instructions;
- clear limitations;
- deployed addresses if deployment succeeds.

Create a final:

**`IMPLEMENTATION_STATUS.md`**

with:

### Completed

Every implemented PRD requirement.

### Tests

Exact test commands and final results.

### Deployments

Network + addresses.

### Demo

Exact reproducible demo flow.

### Cleanverse

Which calls are live vs mocked/sandboxed.

### Remaining Gaps

Anything genuinely incomplete.

### P1/P2

What should be built next.

Do not hide incomplete work.

---

# 19. Definition of Done

The implementation is not done merely because it compiles.

It is done when a judge can watch the following and understand LIEN immediately:

1. A verified supplier and obligor create/confirm one economic obligation.
2. Two differently rendered documents have different file hashes.
3. Both resolve to the same Canonical Obligation ID.
4. Protocol A finances the obligation.
5. LIEN atomically encumbers it.
6. Protocol B independently attempts to finance the same obligation.
7. Protocol B is rejected on-chain.
8. Protocol B moves zero funds.
9. The UI shows the existing active claim and reason for rejection.
10. After valid repayment/discharge, the history remains auditable.
11. Tests prove the critical invariants.
12. Cleanverse is visibly load-bearing in identity, verified-asset/compliance, and settlement logic according to the PRD.

That is the product.

---

# 20. Final Instruction

Read the complete PRD now.

Then inspect the repository.

Then implement LIEN end-to-end.

Do not return with a plan and wait for permission.

Do not stop after scaffolding.

Do not optimize for the quantity of features.

Optimize for:

- correctness;
- enforceability;
- demo clarity;
- Cleanverse integration depth;
- security;
- hackathon judging impact.

**Ship the strongest working version of LIEN that satisfies the PRD.**
