1. Overview

Product Name: Lien
Full Name: Lien (formerly LienZero)

Lien is a pre-mint and pre-collateralization firewall for Real-World Assets (RWAs). It prevents the same underlying real-world asset (primarily invoices and receivables) from being tokenized or pledged multiple times across platforms or chains.

Lien creates a privacy-preserving Asset Fingerprint, checks a shared Encumbrance Registry, and only allows an asset to be minted as a Cleanverse Verified Asset (CVA) if it is clean. When the asset is financed, a first-priority lien is registered. Any subsequent attempt to re-tokenize or re-pledge the same asset is blocked before funds can move.

One-sentence summary:
Lien ensures that one real-world asset cannot secretly back multiple on-chain loans by making Cleanverse CVI + CVA the anti-fraud identity of the asset itself.

2. Problem Statement

Blockchains prevent double-spending of tokens but cannot prove that the underlying real-world asset has not already been tokenized or financed elsewhere.

Common attack / fraud pattern:





An invoice is tokenized and financed on one platform.



The same invoice is slightly modified or re-uploaded.



It is tokenized or pledged again on another platform or chain.



The issuer receives multiple loans against the same real-world asset.

This is a recognized problem in trade finance (duplicate invoicing) and RWA markets. Existing solutions are fragmented, manual, or siloed. Lien solves it at the point of minting and collateralization using Cleanverse’s verified identity and verified asset primitives.

3. Goals

Primary Goal
Build a working MVP that clearly demonstrates:





Successful first-time financing of an invoice as a CVA



Automatic blocking of a second financing attempt on the same underlying asset



Deep, visible integration of Cleanverse CVI and CVA

Secondary Goals





Produce a clean, understandable demo for judges



Show full auditability of the asset lifecycle



Keep the system realistic for a 48-hour build while remaining extensible

4. Target Users



| User | Description | Main Needs |
| --- | --- | --- |
| Issuer (SME) | Company that owns the real-world asset (invoice) | Submit asset, get it verified & financed safely |
| Lender | Verified entity providing financing | Confidence that the asset is not already pledged |
| Compliance / Admin | Internal or external auditor | Full audit trail and evidence package |

All critical parties must hold a valid CVI.

5. Core Features (MVP)

5.1 Asset Fingerprint Creation





Generate a deterministic fingerprint from key fields:





Issuer CVI



Debtor / Owner CVI



Document hash (or content hash)



Invoice number



Amount + Currency



Due date



Optional: PO number, shipment reference, jurisdiction



Fingerprint must be privacy-preserving (no raw PII stored in the registry)

5.2 Encumbrance Registry





Store fingerprint → status mapping



Statuses: Available | Lien Active | Redeemed | Cancelled



Record lien details (lender, amount, timestamp, priority)



Support exact-match lookup (near-duplicate detection is out of scope for MVP)

5.3 Cleanverse-Gated Minting





Only CVI-verified issuers can create fingerprints and request minting



Asset can only be minted as a CVA after the registry confirms it is clean



Minting is blocked if any active or conflicting claim exists

5.4 Lien Registration & Release





When a CVI-verified lender finances the CVA, register a first-priority lien



On repayment confirmation, release the lien and update status



Optionally lock or burn the CVA on release (configurable)

5.5 Blocking Duplicate Attempts





Any later attempt to mint or finance the same fingerprint is rejected



Clear user-facing error:
“Financing rejected: Active first-priority claim exists on this receivable.”

5.6 Audit & Compliance Trail





Log every critical action (fingerprint creation, mint, lien registration, rejection, release)



Ability to generate a simple compliance / evidence report

5.7 Basic Dashboards





Issuer Dashboard: Submit asset, view status, see lien state



Lender Dashboard: Review clean assets, finance, see active liens



Audit View: Timeline of events for any fingerprint

6. Key User Flows

Happy Path – First Financing





Issuer connects wallet → CVI verified



Issuer submits invoice details → Fingerprint generated



Registry check → Clean



Asset minted as CVA



Lender (CVI verified) finances it



Lien registered as Active



Dashboard shows “Financed – First Lien Active”

Rejection Path (Killer Demo)





Same (or modified) invoice is submitted again



Fingerprint matches existing active lien



System blocks minting/financing



Clear rejection message + audit log entry

Repayment Path





Loan is repaid



Lender confirms



Lien released



Status updated + audit trail closed

7. Cleanverse Integration Requirements

This is the highest-priority judging criterion.





CVI must be checked for Issuer, Debtor (if applicable), and Lender before any critical action



CVA is the only allowed on-chain representation of the asset



Minting of CVA is conditional on a successful Lien registry check



All value movement happens only between CVI-verified parties



Full traceability of actions must be maintained for audit reports



The system should make CVI + CVA feel like the anti-fraud identity of the asset, not just an access gate

8. Technical Requirements

Monorepo: Turborepo

Apps





apps/web → Next.js 15/16 (App Router) + TypeScript + Tailwind + shadcn/ui



apps/api → NestJS + TypeScript



apps/contracts → Hardhat

Packages





packages/sdk → Shared types, fingerprint utilities, Cleanverse helpers



packages/ui → Shared components



packages/typescript-config & eslint-config

Backend





NestJS



PostgreSQL + TypeORM



Cleanverse API/SDK integration



Wallet-based authentication

Frontend





wagmi + viem



TanStack Query



Zustand



React Hook Form + Zod

Smart Contracts





Hardhat



Focus on registry reference, lien status, and CVA minting gate (as much as Cleanverse allows)

Database (core entities)





Fingerprint



Lien



AuditLog



User (wallet + CVI status cache)

9. Non-Functional Requirements





MVP must be demoable end-to-end in under 3 minutes



Clear success and failure states in the UI



Fast feedback when a duplicate is detected



Code should be clean enough for judges to understand the architecture



Prioritize reliability of the core fingerprint → check → mint/block flow over extra features

10. Out of Scope (MVP)





Near-duplicate / fuzzy matching of documents



True cross-chain registry synchronization



Complex multi-lien priority queues



Full legal ownership dispute resolution



Production-grade key management or custody



Mobile app

11. Success Criteria (Hackathon)





Judges can clearly see a first financing succeed and a second attempt get blocked



CVI and CVA are used visibly and meaningfully (not just a checkbox)



A basic audit trail / report can be shown



The demo narrative is easy to follow: “One real-world asset can no longer secretly back multiple loans”

12. Open Questions / Assumptions





Cleanverse sandbox API access and exact CVI/CVA minting interfaces will be available



For MVP we can store the primary registry in PostgreSQL and mirror critical state on-chain if needed



Exact match on fingerprint is sufficient for the hackathon demo



Document upload can be simplified to manual field entry + optional hash if file handling becomes a time sink