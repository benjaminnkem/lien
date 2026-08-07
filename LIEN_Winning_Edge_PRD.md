PRODUCT REQUIREMENTS DOCUMENT

LIEN

The Encumbrance Control Plane for Tokenized Real-World Assets

Winning-edge upgrade for the Cleanverse Build: Trusted Assets Hackathon

**North Star:** Blockchains prevent double-spending of tokens. Lien prevents double-spending of the real-world asset underneath them.

| **Document**          | **Value**                                   |
| --------------------- | ------------------------------------------- |
| Product               | Lien                                        |
| Track                 | RWA - Real-World Assets, Verified           |
| Build target          | Monad testnet + Cleanverse sandbox          |
| Primary asset for MVP | Verified B2B invoice / receivable           |
| MVP posture           | Infrastructure primitive, not a marketplace |
| Version               | Hackathon PRD v1.0                          |
| Date                  | 7 August 2026                               |

## Decision summary

The current Lien concept becomes substantially stronger if it stops being a duplicate-invoice checker and becomes an enforceable, cross-protocol encumbrance system. The MVP must prove three things: (1) the same economic obligation gets one canonical identity even when documents differ, (2) reservation and financing are atomic enough that two lenders cannot both pass a check-then-mint race, and (3) independent protocols can consume the same shared encumbrance state before value moves.

# Contents

1\. Executive Summary

2\. Product Thesis and Winning Position

3\. Problem Definition

4\. Goals, Non-Goals and Product Principles

5\. Users and Core Jobs

6\. Core Domain Model

7\. MVP User Journeys

8\. Functional Requirements

9\. Smart-Contract and System Architecture

10\. Cleanverse Integration

11\. Security, Threat Model and Invariants

12\. UX and Demo Experience

13\. Hackathon Scope and Delivery Plan

14\. Judging Strategy

15\. Pitch Pack

16\. Hostile Judge Q&A

17\. Roadmap Beyond the Hackathon

18\. Final Build Checklist

# 1\. Executive Summary

Lien is a pre-mint and pre-collateralization encumbrance control plane for tokenized real-world assets. Its job is not merely to detect that an invoice looks duplicated. Its job is to give a verified economic obligation one canonical identity, maintain one shared protocol-level encumbrance state, and require integrated financing protocols to reserve that state before they mint or lend against the asset.

**Winning upgrade:** Move from advisory detection ("we found a duplicate") to enforceable coordination ("a conflicting financing cannot obtain a valid clearance and is blocked before funds move").

The MVP focuses on invoices because they make the double-financing problem intuitive. The architecture, however, must be generic enough to support warehouse receipts, purchase orders, equipment claims, private-credit notes and other financeable RWAs.

## What the hackathon demo must prove

1. A verified supplier creates an economic obligation and a verified buyer/obligor countersigns it.
2. Lien derives a canonical Obligation ID from normalized economic terms and signed attestations, not from the PDF binary alone.
3. Financing Protocol A atomically reserves and activates the claim, moving the obligation into ENCUMBERED state.
4. Financing Protocol B presents a visually different PDF representing the same underlying obligation. The raw document hash differs, but Lien resolves the same Obligation ID and rejects financing before funds move.
5. A simulated concurrent financing attempt shows only one reservation can win.
6. Repayment discharges the claim without erasing history; the obligation becomes eligible for future financing only if the product terms permit it.

# 2\. Product Thesis and Winning Position

The competitive danger is straightforward: duplicate-financing detection is a known problem, and several projects in the supplied field attack invoice authenticity, duplicate financing or attested receivables. Lien should therefore avoid competing as "another invoice-finance app with fraud checks." Its winning position is lower in the stack: an infrastructure primitive that other RWA protocols can call.

| **Weak positioning**                         | **Winning positioning**                                                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| "We hash invoices and check for duplicates." | "We give verified economic obligations a canonical identity and shared encumbrance state."                               |
| "Lien warns a lender."                       | "Lien clearance is consumed by the financing transaction; conflicting financing cannot proceed in integrated protocols." |
| "One app prevents duplicates inside itself." | "Independent protocols coordinate against one encumbrance registry."                                                     |
| "Document hash = asset identity."            | "Evidence files attach to an Obligation ID; the economic obligation is the asset identity."                              |
| "Already financed: true/false."              | "Verified → Reserved → Encumbered → Discharged / Disputed / Defaulted lifecycle."                                        |

**Category:** On-chain Encumbrance Infrastructure for verified RWAs. Lien is complementary to issuers, marketplaces, lending pools and repo desks rather than competing with all of them.

## One-line product promise

Before a real-world claim can be minted or pledged in an integrated protocol, Lien proves who created it, what obligation it represents, whether it is already encumbered, and atomically reserves the claim for the financing that is about to settle.

# 3\. Problem Definition

A blockchain prevents the same token from being spent twice. It does not prevent a party from creating two different tokens, on two different applications, that both claim to be backed by the same off-chain invoice or receivable. That gap exists because the chain sees token state, while the duplicated object is the underlying economic claim.

## Failure modes Lien must address

| **Failure mode**              | **Why naive approaches fail**                                                 | **Lien response**                                                                    |
| ----------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Same invoice, two lenders     | Each lender checks only its own database.                                     | Shared Obligation ID + encumbrance state.                                            |
| Same economics, modified PDF  | Binary document hashes differ.                                                | Canonicalize the obligation; evidence hash is supporting data, not identity.         |
| Check-then-mint race          | Two parties can both observe CLEAN before either writes a lien.               | Atomic reservation with expiry and single-winner semantics.                          |
| Fake invoice registered first | Uniqueness does not prove authenticity.                                       | Verified issuer + verified obligor countersignature / attestation.                   |
| Replayed clearance            | A signed "clean" result can be reused.                                        | Nonce, protocol binding, expiry and one-time consumption.                            |
| Repayment erases history      | Deleting state loses provenance.                                              | DISCHARGED state preserves prior financing and repayment references.                 |
| Legal overclaim               | On-chain timestamp is not universally equivalent to perfected legal priority. | State claims are explicitly protocol-level unless a legal integration provides more. |

## Core product question

**Invariant the product exists to enforce:** Within the set of integrated protocols, an economic obligation that is subject to an exclusive active claim cannot simultaneously secure a second conflicting exclusive financing.

# 4\. Goals, Non-Goals and Product Principles

## Goals

- Identify the economic obligation rather than relying solely on the document binary.
- Require verified counterparties for obligation creation/confirmation.
- Provide atomic reservation, activation and discharge semantics.
- Expose a protocol-consumable clearance that is bound to obligation, protocol, amount, expiry and nonce.
- Support independent financing protocols against one canonical registry.
- Produce audit-ready evidence for every successful and rejected financing attempt.
- Make conflict reasons understandable in the UI and machine-readable in the SDK.

## Non-goals for the 48-hour MVP

- No AI underwriting or credit scoring.
- No investor marketplace or yield optimization.
- No claim that Lien establishes universally perfected legal security interests.
- No production-grade cross-chain bridge.
- No zero-knowledge system unless already implemented and tested.
- No attempt to support every RWA type; invoices are the demo asset.
- No new token or governance mechanism.

## Product principles

| **Principle**                     | **Interpretation**                                               |
| --------------------------------- | ---------------------------------------------------------------- |
| Economic identity > file identity | A PDF can change while the obligation remains the same.          |
| Reserve, do not merely check      | A clean result that is not locked is raceable.                   |
| Fail before value moves           | Conflicts are rejected before settlement or mint completion.     |
| History is append-only            | Discharge changes current state; it does not erase prior claims. |
| Compliance is load-bearing        | CVI/CVA/CCP are execution conditions, not dashboard badges.      |
| Narrow core, strong proof         | One excellent invariant beats ten half-built features.           |

# 5\. Users and Core Jobs

| **User**                    | **Job to be done**                                                  | **MVP action**                                                   |
| --------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Asset originator / supplier | Prove a real obligation and seek financing.                         | Create obligation; attach evidence; obtain obligor confirmation. |
| Obligor / buyer             | Confirm that the payable exists under stated terms.                 | Sign typed obligation attestation.                               |
| Financing protocol          | Know whether it can safely mint/lend against the claim.             | Request clearance; reserve; activate; discharge.                 |
| Lender / liquidity provider | Avoid unknowingly financing an already pledged claim.               | See current encumbrance and rejection reason.                    |
| Compliance / auditor        | Reconstruct who asserted, financed, blocked and discharged a claim. | Inspect event trail and export evidence.                         |
| RWA protocol developer      | Integrate duplicate-financing prevention with minimal code.         | Use LienGuard SDK/contract interface.                            |

# 6\. Core Domain Model

## 6.1 Canonical Obligation ID

The Obligation ID identifies the economic claim. It must not be a plain hash of the uploaded document. For the MVP, derive it from a canonical typed structure signed or confirmed by the verified parties.

ObligationTerms {  
supplierCviRef  
obligorCviRef  
currency  
faceValue  
dueDate  
invoiceReference  
purchaseOrderReference?  
evidenceRoot  
jurisdiction?  
version  
nonce  
}  
<br/>obligationId = keccak256(EIP712CanonicalTerms)

Important: if the exact canonicalization rules are not strong enough to detect semantically identical but deliberately altered records, do not pretend they are. The hackathon proof should show one controlled normalization path and explain that production deployments can add issuer/obligor-specific matching policies.

## 6.2 Evidence Root

The evidence layer stores hashes/commitments to source documents and attestations. The evidence proves what was presented; it does not by itself define the asset identity. Multiple evidence versions may point to one Obligation ID.

## 6.3 Encumbrance State Machine

UNREGISTERED  
|  
v  
VERIFIED -----> CANCELLED  
|  
v  
RESERVED -----> VERIFIED (reservation expires/cancels)  
|  
v  
ENCUMBERED ---> DEFAULTED  
| \\------> DISPUTED  
v  
DISCHARGED

| **State**  | **Meaning**                                         | **Key allowed transitions**                 |
| ---------- | --------------------------------------------------- | ------------------------------------------- |
| VERIFIED   | Obligation confirmed; no active exclusive claim.    | RESERVED, CANCELLED                         |
| RESERVED   | Exclusive financing window granted to one protocol. | ENCUMBERED, VERIFIED on expiry/cancel       |
| ENCUMBERED | Active financing claim exists.                      | DISCHARGED, DEFAULTED, DISPUTED             |
| DISCHARGED | Prior claim released/repaid; history preserved.     | VERIFIED / new lifecycle if product permits |
| DEFAULTED  | Obligation unpaid under financing terms.            | Workout / closeout integrations later       |
| DISPUTED   | Claim or evidence challenged.                       | Operator/legal workflow outside MVP         |

## 6.4 Lien Clearance

A Lien Clearance is not a generic "clean" certificate. It is a one-time, bounded authorization for one financing context.

LienClearance {  
obligationId  
protocol  
chainId  
financingAmount  
reservationId  
issuedAt  
expiresAt  
nonce  
currentState  
identityChecksHash  
evidenceHash  
}

# 7\. MVP User Journeys

## Journey A - First financing succeeds

1. Supplier connects wallet and passes/holds required CVI status.
2. Supplier creates invoice obligation and uploads evidence; backend computes evidence hash/root.
3. Obligor connects and signs canonical obligation terms.
4. Lien marks the Obligation ID VERIFIED.
5. Protocol A requests reservation for a defined amount and expiry.
6. Lien atomically marks RESERVED and returns reservationId / clearance.
7. Protocol A completes CVA issuance/funding settlement.
8. Protocol A activates the reservation; Lien marks ENCUMBERED and emits ClaimActivated.

## Journey B - Different-looking duplicate is blocked

1. Attacker/supplier presents a regenerated PDF with a different raw file hash.
2. Canonical terms resolve to the same Obligation ID.
3. Protocol B requests financing.
4. Lien returns conflict state ENCUMBERED with reason code ASSET_ALREADY_ENCUMBERED.
5. Protocol B does not mint/fund and displays the conflict evidence.

## Journey C - Concurrent reservation race

1. Two financing protocols request reservation against the same VERIFIED obligation.
2. Only the first state-changing transaction succeeds.
3. The second reverts/returns RESERVATION_CONFLICT.
4. Foundry invariant test proves at most one exclusive active reservation exists.

## Journey D - Repayment and discharge

1. Borrower/obligor settles financing according to the demo terms.
2. Authorized financing protocol calls discharge with repayment reference.
3. Lien marks DISCHARGED and retains financier, amount, activation and discharge references.
4. UI shows "Previously financed - discharged" rather than erasing the claim history.

# 8\. Functional Requirements

| **ID** | **Requirement**                                                 | **Priority** | **Acceptance criterion**                                                         |
| ------ | --------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| FR-01  | Create canonical obligation record from normalized typed terms. | P0           | Same demo obligation resolves to same ID despite changed file binary.            |
| FR-02  | Require verified supplier identity.                             | P0           | Unverified supplier cannot register a financeable obligation.                    |
| FR-03  | Require verified obligor confirmation / countersignature.       | P0           | Obligation remains pending until obligor signs.                                  |
| FR-04  | Attach evidence hashes/root to Obligation ID.                   | P0           | Evidence is queryable without exposing raw document on-chain.                    |
| FR-05  | Atomic reserve operation.                                       | P0           | Two active exclusive reservations cannot coexist.                                |
| FR-06  | Reservation expiry/cancel path.                                 | P0           | Expired reservation returns obligation to financeable state.                     |
| FR-07  | Activation consumes reservation.                                | P0           | Only reservation owner may activate; cannot activate twice.                      |
| FR-08  | Protocol-bound one-time clearance.                              | P0           | Replay from another protocol/nonce is rejected.                                  |
| FR-09  | Status query + machine-readable reason codes.                   | P0           | Integrator can distinguish CLEAN, RESERVED, ENCUMBERED, etc.                     |
| FR-10  | Discharge active claim.                                         | P0           | Only authorized claim controller may discharge.                                  |
| FR-11  | Append-only audit events.                                       | P0           | Successful/rejected state-changing attempts are reconstructable.                 |
| FR-12  | Two independent adapter/demo protocols.                         | P0           | Protocol A succeeds; Protocol B is blocked against same obligation.              |
| FR-13  | Claim graph UI.                                                 | P1           | User sees original financing and blocked conflicting attempt.                    |
| FR-14  | Export evidence pack.                                           | P1           | JSON or PDF contains obligation, identity checks, state transitions and tx refs. |
| FR-15  | Priority/subordinate claims.                                    | P2           | Only if core P0 is complete; label protocol-level priority only.                 |

## Reason codes

OBLIGATION_NOT_VERIFIED  
OBLIGOR_CONFIRMATION_MISSING  
IDENTITY_NOT_ELIGIBLE  
RESERVATION_CONFLICT  
RESERVATION_EXPIRED  
CLEARANCE_ALREADY_CONSUMED  
CLEARANCE_PROTOCOL_MISMATCH  
ASSET_ALREADY_ENCUMBERED  
UNAUTHORIZED_DISCHARGE  
INVALID_STATE_TRANSITION

# 9\. Smart-Contract and System Architecture

CLEANVERSE  
CVI / CVA / CCP / reporting  
|  
v  
+------------------+ +--------------------+ +-------------------+  
| Obligation |->| Lien Registry / |<-| Protocol Adapter A|  
| Attestation | | LienGuard | | (invoice finance) |  
+------------------+ +--------------------+ +-------------------+  
^ ^  
| |  
| +---------- Protocol Adapter B  
| (second lender/demo)  
|  
+---------------+  
| Audit / Indexer|  
+---------------+

## Recommended contracts

| **Contract**       | **Responsibility**                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| ObligationRegistry | Stores canonical obligation records, evidence roots, confirmation status and immutable metadata refs.                    |
| LienGuard          | Owns reservation/encumbrance state machine and conflict enforcement.                                                     |
| ClearanceManager   | Issues/validates protocol-bound clearance semantics if separated from LienGuard. Can be folded into LienGuard for speed. |
| DemoFinanceA       | Minimal financing adapter that reserves → settles/mints → activates.                                                     |
| DemoFinanceB       | Independent adapter used to prove shared-state conflict prevention.                                                      |
| CleanverseAdapter  | Normalizes sandbox calls / attestation reads / reason codes for CVI/CVA/CCP.                                             |

## Minimal integration interface

interface ILienGuard {  
function reserve(  
bytes32 obligationId,  
uint256 financingAmount,  
uint64 expiry  
) external returns (bytes32 reservationId);  
<br/>function activate(  
bytes32 reservationId,  
bytes32 financingRef  
) external;  
<br/>function discharge(  
bytes32 obligationId,  
bytes32 repaymentRef  
) external;  
<br/>function status(bytes32 obligationId)  
external view returns (LienStatus memory);  
}

## Important implementation rule

**No "check then later reserve" happy path:** The financing integration should call the state-changing reservation before issuing/funding. Any read-only preflight is UX only; the write-time reservation is the security boundary.

# 10\. Cleanverse Integration

Cleanverse must be part of the execution path, not decorative metadata. The cleanest story is a layered trust model: identity proves who is asserting the obligation, the obligor confirms what exists, Lien proves whether the claim is already encumbered, CVA represents/settles the verified asset, and CCP/policy checks determine whether the value-moving action is currently permitted.

| **Cleanverse primitive** | **Lien use**                                                                               | **Judge-visible proof**                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| CVI                      | Verify supplier/originator, obligor and financing counterparties; re-check where required. | An unverified party cannot create/confirm/receive in the protected path.          |
| CVA                      | Verified asset / clean settlement rail for successful financing.                           | Protocol A finances successfully only through the compliant asset path.           |
| CCP / rules              | Pre-transaction policy check before relevant value movement.                               | Blocked compliance case produces a specific reason before settlement.             |
| Travel Rule / reporting  | Bind settlement evidence to the financing lifecycle.                                       | Audit export links identity checks, obligation, encumbrance and transaction refs. |

**Do not overclaim:** Lien does not magically prove a real-world document is legally valid merely because it is hashed. Authenticity comes from verified parties and attestation/evidence processes; legal enforceability depends on the underlying agreement and jurisdiction.

# 11\. Security, Threat Model and Invariants

## Threat model

| **Threat**           | **Attack**                                              | **Control**                                                     |
| -------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Binary mutation      | Change PDF formatting/metadata to evade duplicate hash. | Canonical Obligation ID + evidence history.                     |
| Check-mint race      | Two lenders read CLEAN simultaneously.                  | Atomic reserve with single active reservation.                  |
| Clearance replay     | Reuse old/foreign clean certificate.                    | Nonce + expiry + protocol/chain binding + one-time consumption. |
| Fake obligor         | Originator invents buyer payable.                       | CVI-verified obligor countersignature.                          |
| Unauthorized release | Borrower clears lien unilaterally.                      | Only active claim controller / authorized path can discharge.   |
| Stale identity       | Credential changes after initial check.                 | Re-check at configured value-moving transitions.                |
| Front-end bypass     | Attacker calls finance contract directly.               | Adapter enforces reservation/clearance in contract execution.   |
| DoS via reservations | Attacker repeatedly locks claims.                       | Short expiry, verified callers, optional bond/rate limit later. |

## P0 invariants

- For any obligationId, activeExclusiveReservations <= 1.
- A consumed reservation/clearance can never be activated twice.
- An ENCUMBERED obligation cannot receive a conflicting exclusive claim.
- Only the reservation owner can activate it.
- Only the active claim controller or explicitly authorized settlement path can discharge it.
- Changing the evidence-file bytes alone does not create a new obligation when the canonical economic terms are unchanged in the demo policy.
- Every successful state transition emits enough data to reconstruct the lifecycle.
- Every blocked financing fails before CVA funding/mint completion in the protected demo path.

## Testing target

Use unit tests for every transition and failure reason, plus Foundry fuzz/invariant tests for reservation exclusivity, replay resistance and authorization. If time is limited, tests are more valuable than adding P2 product features because build quality is a major judging dimension.

# 12\. UX and Demo Experience

The UI should feel like an asset-claim control room, not a generic crypto dashboard. The central visual object is the Obligation ID and its claim history.

## Screen 1 - Obligation Passport

| **Field**        | **Example**                        |
| ---------------- | ---------------------------------- |
| Obligation       | OBL-7BF2...91AC                    |
| Supplier         | Acme Components - CVI verified     |
| Obligor          | Atlas Manufacturing - CVI verified |
| Face value       | \$100,000                          |
| Due date         | 30 Sep 2026                        |
| Evidence         | 2 files / evidence root 0x...      |
| Current state    | ENCUMBERED                         |
| Active financier | Protocol A                         |
| Secured amount   | \$80,000                           |

## Screen 2 - Asset Claim Graph

OBL-7BF2...91AC  
|  
+----------+----------+  
| |  
FINANCING #1 ATTEMPT #2  
Protocol A Protocol B  
\$80,000 \$75,000  
| |  
ENCUMBERED BLOCKED  
| same Obligation ID  
REPAID  
|  
DISCHARGED

## Screen 3 - Conflict proof

**Visual signature:** Show two different raw PDF hashes side-by-side, then the same canonical Obligation ID beneath them, followed by "BLOCKED BEFORE FUNDS MOVED - ASSET_ALREADY_ENCUMBERED."

## Demo script - 4 to 5 minutes

| **Time**  | **Action**                                    | **Message**                                                                           |
| --------- | --------------------------------------------- | ------------------------------------------------------------------------------------- |
| 0:00-0:25 | Open with the problem and one-line thesis.    | "A chain stops double-spending a token, not double-pledging the asset underneath it." |
| 0:25-1:10 | Create/confirm obligation.                    | Verified supplier + verified buyer produce one canonical obligation.                  |
| 1:10-1:50 | Finance in Protocol A.                        | Reserve → compliant funding → activate → ENCUMBERED.                                  |
| 1:50-2:50 | Attack from Protocol B with modified PDF.     | Raw hashes differ; Obligation ID matches; financing is blocked before value moves.    |
| 2:50-3:30 | Run concurrent reservation proof / show test. | Only one reservation can win; check-then-mint race is closed.                         |
| 3:30-4:10 | Repay/discharge.                              | History stays visible; state changes to DISCHARGED.                                   |
| 4:10-4:40 | Show audit/SDK architecture.                  | Lien is infrastructure other RWA protocols consume.                                   |

# 13\. Hackathon Scope and Delivery Plan

The project wins by completing the enforcement loop. Scope discipline is mandatory.

| **Tier**                             | **Build**                                                                                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0 - must ship                       | Canonical obligation + obligor confirmation; CVI integration; evidence root; LienGuard state machine; atomic reserve/activate/discharge; one-time clearance semantics; two independent protocol adapters; CVA/CCP protected funding path; conflict UI; Foundry tests. |
| P1 - ship if P0 is green             | Audit export, claim graph polish, reservation expiry UI, additional compliance failure demo, developer SDK wrapper.                                                                                                                                                   |
| P2 - only if everything else is done | Subordinate priority claims, cross-chain architecture mock, richer attestation adapters.                                                                                                                                                                              |
| Do not build                         | AI, marketplace, token, DAO, yield engine, production bridge, generic underwriting, complex ZK.                                                                                                                                                                       |

## Suggested build order

1. Lock the canonical ObligationTerms schema and state machine.
2. Implement LienGuard + tests before UI.
3. Implement two minimal financing adapters and prove conflict enforcement.
4. Wire Cleanverse verification and compliant settlement path.
5. Build the Obligation Passport / claim graph UI around real contract state.
6. Add audit export and demo polish only after invariants pass.

## Definition of done

- The exact demo can be run from a clean state without manual database edits.
- The second financing genuinely fails at the protected protocol layer, not just the front end.
- Two modified evidence files resolve to the same demo Obligation ID.
- At least one concurrency/invariant test is shown or linked.
- Cleanverse checks are visible in the transaction path.
- Repayment/discharge preserves prior encumbrance history.
- No claim is made that protocol ordering equals universal legal lien perfection.

# 14\. Judging Strategy

The hackathon description emphasizes CVI/CVA integration, build quality, concept, demo/UX and scalability. Lien should explicitly map its demo to those dimensions rather than forcing judges to infer the value.

| **Dimension**       | **Lien answer**                                                                                                                       |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Concept / problem   | Double financing exists below the token layer. Lien prevents conflicting claims against the underlying verified obligation.           |
| CVI/CVA integration | Verified originator + obligor confirmation + compliant financing/settlement; Cleanverse is in the execution path.                     |
| Build quality       | Atomic reservation, replay protection, explicit state machine, independent adapters, invariant tests.                                 |
| UX / demo           | Different PDFs → same Obligation ID → second protocol blocked before funds move; visible claim graph.                                 |
| Scalability         | Lien sits under invoice finance, repo, lending, warehouse receipts and other RWA protocols instead of being one vertical marketplace. |

## The three judge memories to engineer

1. "Same PDF? No - same economic obligation."
2. "They closed the check-then-mint race with reservation."
3. "This is infrastructure other hackathon projects could integrate."

# 15\. Pitch Pack

## Taglines

- Blockchains prevent double-spending of tokens. Lien prevents double-spending of the real-world asset underneath them.
- One verified obligation. One shared encumbrance state. No conflicting financing.
- The pre-mint firewall for tokenized collateral.
- Know what already backs a loan before you create another token against it.

## 30-second pitch

Lien is the encumbrance control plane for tokenized real-world assets. A blockchain can stop you spending the same token twice, but it cannot stop the same invoice from being tokenized or pledged on two different platforms. Lien gives every verified economic obligation one canonical identity and one shared encumbrance state. Before an integrated protocol can mint or finance that asset, it must atomically reserve the claim. The first financing succeeds; any conflicting second financing is blocked before funds move. Cleanverse verifies the parties and the compliant asset flow; Lien adds the missing cross-protocol claim state underneath them.

## 90-second pitch

Today, two different smart contracts can each issue a token backed by the same real-world invoice because blockchains only know the tokens - they do not know that the underlying economic claim is duplicated. Basic document hashing does not solve this: change the PDF metadata or regenerate the document and the hash changes, and a read-only "clean" check is raceable if two lenders check at the same time. Lien fixes both problems. A CVI-verified supplier and obligor create one canonical Obligation ID from signed economic terms. Financing protocols do not merely check it; they atomically reserve it. Once financing settles, the claim becomes ENCUMBERED in a shared registry that independent protocols consume. In our demo, Protocol A finances a \$100,000 invoice. Protocol B then receives a visually different PDF with a different raw hash, but Lien resolves the same Obligation ID and rejects the second financing before any CVA funds move. We also race two reservations and prove only one can win. Lien turns duplicate-financing detection from an alert into enforceable RWA infrastructure.

## 3-minute pitch structure

| **Beat**   | **What to say**                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Hook       | "Blockchains solved double-spending for tokens, not for the real-world assets underneath them."                                  |
| Problem    | Same receivable can be represented in multiple apps; document hashes and local databases are insufficient.                       |
| Insight    | The object that needs uniqueness is the economic obligation, not the PDF. The operation that needs safety is reserve, not check. |
| Product    | Canonical Obligation ID + shared encumbrance state + one-time protocol-bound clearance.                                          |
| Cleanverse | CVI authenticates the parties; CVA/CCP protect the compliant financing path; Lien adds encumbrance coordination.                 |
| Demo       | Protocol A succeeds. Protocol B uses modified evidence and is blocked. Concurrent reservation test shows one winner.             |
| Scale      | Any RWA issuer/lender/repo desk can integrate LienGuard before mint or collateral acceptance.                                    |
| Close      | "One verified obligation. One shared encumbrance state. No conflicting financing."                                               |

## Recommended project description for submission

Lien is a pre-mint and pre-collateralization encumbrance control plane for tokenized real-world assets. Blockchains prevent double-spending of tokens, but they cannot natively prevent the same underlying invoice, receivable or asset from being represented or pledged across different protocols. Lien gives each verified economic obligation a canonical Obligation ID derived from normalized terms and verified counterparty attestations, then maintains a shared lifecycle state: VERIFIED, RESERVED, ENCUMBERED and DISCHARGED. Integrated financing protocols must atomically reserve an obligation before minting or lending against it, eliminating the check-then-mint race and blocking conflicting financing before value moves. Cleanverse CVI verifies the originator, obligor and counterparties; CVA and compliance checks protect the financing and settlement path. The hackathon demo shows two independent protocols receiving different document binaries for the same obligation: the first financing succeeds, while the second resolves to the same Obligation ID and is rejected on-chain because an active encumbrance already exists.

# 16\. Hostile Judge Q&A

| **Question**                                             | **Best answer**                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Isn't this just hashing invoices?"                      | No. File hashes are evidence. Lien identifies the economic obligation from canonical signed terms, then enforces a shared encumbrance state. We deliberately demo different file hashes resolving to the same obligation.                                                                                  |
| "What stops two lenders from checking at the same time?" | A read-only check is not the security boundary. Financing requires an atomic state-changing reservation; only one exclusive reservation can exist.                                                                                                                                                         |
| "What if someone registers a fake invoice first?"        | Uniqueness is not authenticity. The MVP requires the verified obligor to countersign the canonical obligation before it becomes financeable.                                                                                                                                                               |
| "Does this create a legally perfected lien?"             | Not by itself. We are precise: Lien establishes protocol-level encumbrance coordination for integrated systems. Legal perfection depends on asset type, agreements and jurisdiction.                                                                                                                       |
| "What if another platform doesn't integrate Lien?"       | We cannot block a completely disconnected system. The value is a shared standard/control plane: within integrated protocols, conflicts become enforceable rather than informational. Adoption expands the protected set.                                                                                   |
| "Why Cleanverse?"                                        | CVI tells us which verified entities are asserting and confirming the obligation, while CVA/CCP protect the compliant asset and settlement path. Lien solves a different missing layer: whether that verified claim is already encumbered elsewhere in the integrated network.                             |
| "Why not a centralized database?"                        | A central registry can detect conflicts, but Lien's core value in this prototype is composable enforcement: smart contracts consume the same state and cannot complete protected financing without reservation. Production deployments could combine on-chain commitments with permissioned data services. |
| "How is this different from Coven/Mordant?"              | Those are financing/fraud products around particular flows. Lien is meant to be the shared encumbrance primitive underneath multiple independent RWA protocols. Our demo uses two separate financing adapters to prove that architecture.                                                                  |

# 17\. Roadmap Beyond the Hackathon

| **Phase**                      | **Capability**                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1 - Hackathon                  | Invoice obligations, debtor confirmation, reserve/activate/discharge, two protocol adapters, Cleanverse integration.       |
| 2 - Asset adapters             | Warehouse receipts, purchase orders, equipment claims, private-credit notes.                                               |
| 3 - Claim structure            | Partial/subordinate claims and disclosed protocol-level priority where the asset structure permits it.                     |
| 4 - Network                    | Signed cross-domain clearance proofs / canonical registry adapters across supported chains.                                |
| 5 - Institutional integrations | ERP/accounting connectors, registries, trustees/servicers, document attestors and lenders.                                 |
| 6 - Legal/operational depth    | Jurisdiction-specific perfection/notice integrations where real legal rails exist; never inferred merely from chain order. |

## North-star expansion

Lien can become the shared claim-state layer between verified asset origination and financing. The long-term product is not "invoice fraud detection." It is a machine-readable encumbrance graph that tells protocols which verified economic claims exist, who has active protocol-level claims against them, and whether a new financing action conflicts before capital moves.

# 18\. Final Build Checklist

## If these are not green, do not add features

- Canonical ObligationTerms schema is frozen and documented.
- Verified supplier + obligor confirmation works end to end.
- Same demo obligation with modified PDF bytes resolves to same Obligation ID.
- Atomic reserve operation is the financing security boundary.
- Only one exclusive active reservation can exist.
- Activation consumes reservation exactly once.
- Protocol B is genuinely blocked at contract/protocol level before CVA funds move.
- Repayment/discharge preserves history.
- Foundry unit + invariant/fuzz tests pass.
- Cleanverse checks are visible and explainable.
- Claim graph/conflict UI is fed by actual contract state.
- Pitch uses "protocol-level encumbrance" and does not overclaim universal legal lien priority.
- Demo has been rehearsed from a clean deployment/state.
- Readme explains integration in under five minutes for another protocol developer.

**Final product standard:** If the audience remembers only one thing, they should remember that two different RWA protocols tried to finance the same real-world obligation, and Lien let exactly one succeed.

# Appendix A - Suggested event model

event ObligationRegistered(bytes32 indexed obligationId, address indexed supplier, address indexed obligor, bytes32 evidenceRoot);  
event ObligationConfirmed(bytes32 indexed obligationId, bytes32 attestationRef);  
event ReservationCreated(bytes32 indexed obligationId, bytes32 indexed reservationId, address indexed protocol, uint256 amount, uint64 expiry);  
event ReservationExpired(bytes32 indexed obligationId, bytes32 indexed reservationId);  
event ClaimActivated(bytes32 indexed obligationId, bytes32 indexed reservationId, bytes32 financingRef);  
event ClaimDischarged(bytes32 indexed obligationId, bytes32 repaymentRef);  
event FinancingConflict(bytes32 indexed obligationId, address indexed attemptedProtocol, uint8 reasonCode);

# Appendix B - Suggested repository structure

/contracts  
ObligationRegistry.sol  
LienGuard.sol  
CleanverseAdapter.sol  
demo/DemoFinanceA.sol  
demo/DemoFinanceB.sol  
/test  
LienGuard.t.sol  
LienGuardInvariant.t.sol  
DemoAttack.t.sol  
/apps/web  
/packages/sdk  
/services/attestation  
/docs  
architecture.md  
threat-model.md  
demo-script.md

# Appendix C - README opening

**README headline:** Blockchains prevent double-spending of tokens. Lien prevents double-spending of the real-world asset underneath them.

Lien is an encumbrance control plane for verified RWAs. It gives each confirmed economic obligation one canonical identity and requires financing protocols to atomically reserve the claim before minting or lending against it. In the demo, two independent protocols receive different document binaries representing the same invoice. Protocol A finances it. Protocol B resolves the same Obligation ID and is rejected before funds move because the claim is already encumbered.