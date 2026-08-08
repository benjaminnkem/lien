# LIEN — Demo script

Spoken script for `/demo`. Write like a conversation, not a product video.

**Total time (live path):** ~5–7 minutes including wallet confirms.  
**Fallback (operator seed):** ~90–120 seconds if MetaMask is flaky.

---

## Before you walk up (60s silent)

- [ ] Hosted web is up; `/demo` loads without errors  
- [ ] API stack badge: **LienGuard ready**, trust mode known (`live` or `demo`)  
- [ ] MetaMask on **Sepolia**, two accounts ready (Supplier + Obligor) with a little ETH  
- [ ] Optional: Protocol A liquidity already funded on DemoFinanceA (if A fails with “insufficient,” top up once offline)  
- [ ] Browser zoom comfortable; hide tabs; pin MetaMask  
- [ ] One clean obligation (or plan to use a **new nonce** / prepare again if you already encumbered this morning)

**Decide the path:**

| Situation | Use |
| --- | --- |
| Judges care about “real wallets / real txs” | **Live · Sepolia** (top panel) |
| Wi‑Fi bad, wallets stuck, time crunch | **Operator path** (seed below) — still show A then B |

Do **not** apologize into the demo. If you switch paths:  
> “I’ll use the operator seed so we stay on the protocol story instead of wallet UX.”

---

## Opening (landing → demo) · ~30–40s

*On `/` or as you click into `/demo`:*

> Blockchains are really good at one thing: you can’t spend the same token twice.  
> What they’re *not* good at is the asset *under* the token.  
> Same invoice. Two different PDFs. Two lending apps. Both think they’re first.  
> **LIEN is the control plane that makes that fail on-chain — before the second funder sends money.**

*Click **Demo** / open `/demo`.*

> This is the control room. Top half is live wallets on Sepolia. Bottom half is a fast API seed if we need it.

---

## Path A — Live wallets (preferred)

### A1 · Frame the scene · ~20s

*Point at the green “Live · Sepolia wallets” card.*

> Two roles. Supplier is the company that wants financing. Obligor is the buyer who actually owes the money.  
> Financing protocols sit *outside* that relationship — they’re adapters that must ask LienGuard for exclusive access.

*Connect wallet. Confirm chain badge is Sepolia / contracts ready.*

> We’re on public testnet. Real signatures, real contract calls — not a slideshow.

---

### A2 · Same claim, different paperwork (the insight) · ~25s

*If the prepare UI shows dual docs / preview, use it. Otherwise say it while preparing:*

> Most systems fingerprint the PDF. Change a margin, change the hash, look like a new asset.  
> We fingerprint the **economic obligation** — who’s owed, who owes, how much, when, which refs.  
> Document hash is stored for audit. It does **not** get a new Obligation ID.

*Click **Prepare terms** → wait for IDs.*

> Same economics → same Obligation ID. That’s the whole trick.

---

### A3 · Register (supplier) · ~30–45s

*Ensure connected account is **Supplier**. Click **Register as supplier**. Confirm MetaMask.*

> Supplier publishes the terms on-chain. Registration alone is not enough to finance — we still need the obligor to own the deal.

*If CVI/trust live gates flash:*

> Where Cleanverse is configured, participants need a real identity gate — not anonymous EOAs cosplaying as companies. Local seed can skip that; live path doesn’t fake it.

---

### A4 · Obligor signs · ~40–60s

*Switch MetaMask account to **Obligor** (or second wallet). Click **Sign as obligor**. Sign EIP-712 typed data — pause so judges see the typed fields if the wallet shows them.*

> This is the obligor saying: “Yes, those economic terms are mine.”  
> It’s EIP-712 — domain-bound to this registry and chain — not a free-form “I agree” string.

*Click **Confirm on-chain** (supplier or obligor, per your flow). Confirm tx.*

> Now the obligation is **Verified**. Financeable. One passport, one active claim slot.

*Glance at state badge: **Verified**.*

---

### A5 · Protocol A finances · ~30–45s

*Any wallet with the right role for the demo adapters — typically connected as someone who can call finance. Click **Finance · Protocol A**. Confirm.*

> Protocol A is just one financing venue. It calls LienGuard: reserve, move demo settlement, activate.  
> Atomic. If funding fails, the reservation doesn’t stick half-done.

*Wait for success. Point at state: **Encumbered** / claim controller / secured amount if visible.*

> Claim is live. History starts building on the passport.

---

### A6 · The kill shot — Protocol B · ~30–40s

*Click **Attack · Protocol B**. Confirm (or let it revert).*

> Same obligation. Independent adapter. Protocol B thinks it can fund too.  
> Watch — this should **fail before funds move**. Liquidity on B doesn’t leak out as a successful encumbrance.

*When it fails / blocked toast / audit shows finance blocked:*

> That’s the product. Not “we emailed compliance later.” **On-chain exclusive claim, second protocol out.**

*Optional one-liner (only if it lands naturally):*

> Ethereum can stop double-spending the token. Until something like this, nothing stopped two tokens — or two loans — on the same invoice.

---

### A7 · Close the loop · ~25–35s

*Click **Repay & discharge**. Confirm.*

> Debtor pays, controller discharges. State goes **Discharged** — history stays. You can refinance later under the rules; you can’t pretend the first claim never happened.

*Optional: JSON/CSV export if time:*

> And for ops or disputes, we can export an evidence pack without putting the full PDF on-chain.

---

### A8 · Soft close · ~20s

> So for builders: integrate LienGuard the way you integrate an oracle — call it before you fund.  
> SDK is public: `npm install lien-sdk`. Sepolia addresses are in the package.  
> Important honesty: this is **protocol-level** encumbrance for integrated systems — not a claim that we’ve perfected a legal lien in every country.  
> Happy to take questions.

---

## Path B — Operator seed (fast fallback)

*Scroll to **Operator path · API seed · Hardhat rehearsal** (or use when stack is local Hardhat).*

### B1 · Seed · ~15s

*Click seed / create verified obligation.*

> Same story, deterministic. Acme supplies Atlas — hundred thousand face, obligor already confirmed.  
> Obligation passport lights up: **Verified**.

*Point at dual document hashes if shown (Document A ≠ B, same Obligation ID).*

> Two files. One economic ID.

### B2 · A then B · ~40s

*Protocol A finance → Encumbered.*  
*Protocol B finance → blocked.*

> A wins. B is rejected with zero successful fund movement. That’s the attack demo.

### B3 · Discharge · ~15s

*Repay / discharge.*

> Clean exit. Claim history retained.

### B4 · Only if asked / time left

- Subordinate claim → “Disclosure of junior interest — exclusive first lien still on LienGuard.”  
- Cross-chain mock → “Hashed clearance post/consume — **not a bridge**.”  
- Attestations / analytics → “Export and ops surface, not a second source of truth.”

---

## Timing cheat sheet

| Block | Live | Operator |
| --- | --- | --- |
| Open + problem | 0:40 | 0:30 |
| Insight (ID ≠ PDF) | 0:25 | 0:20 |
| Register / seed | 0:45 | 0:15 |
| Obligor sign + confirm | 1:00 | — |
| Protocol A | 0:40 | 0:25 |
| Protocol B blocked | 0:35 | 0:25 |
| Discharge + close | 0:45 | 0:30 |
| **~Total** | **~5–6 min** | **~2 min** |

Leave **1–2 minutes** for questions inside a 7-minute slot.

---

## If something breaks (say this, then recover)

| Symptom | Line | Move |
| --- | --- | --- |
| Wallet stuck / wrong chain | “Network UX — switching to operator seed so we don’t burn the slot.” | Path B |
| Already encumbered | “This ID is already claimed — good, actually. Fresh prepare with a new nonce.” | Prepare again |
| Protocol A reverts (liquidity) | “Adapter needs demo settlement — that’s venue plumbing, not the mutex.” | Retry A or show B fail on an already-A-encumbered seed |
| CVI gate | “Identity gate failed the way it should for an unverified party.” | Use configured demo identities or explain and seed |
| Explorer lag | “Tx is submitted; state will catch up — meanwhile here’s the intended transition.” | Show expected state machine verbally |

---

## One-breath answers (don’t over-explain)

**“Is this a legal lien registry?”**  
> No. Protocol-level exclusive claim for systems that integrate LienGuard.

**“Why not just hash the invoice?”**  
> Hashes track files. Attackers regenerate files. Lenders care about economics.

**“What does Cleanverse do?”**  
> Who’s allowed to participate. LienGuard still decides who holds the claim.

**“What if two protocols race?”**  
> First successful reserve wins; second reverts. Atomic in the adapter.

**“Cross-chain?”**  
> Cross-protocol today. Same ID model can extend; the mock is not a bridge.

**“Where’s the code for integrators?”**  
> `lien-sdk` on npm — `LienClient`, ABIs, Sepolia deployments.

---

## Lines to avoid

- “We perfected liens worldwide.”  
- “This replaces banks / UCC filings.”  
- “dUSDC is real dollars.”  
- “Cross-chain bridge is production-ready.”  
- Long architecture lectures before the B-fail moment.

---

## Rehearsal checklist (run once day-of)

1. Full live path once, cold wallets.  
2. Full operator seed once (backup muscle memory).  
3. Practice the **B-fail sentence** until it sounds casual, not triumphant.  
4. Practice the **honesty line** (protocol-level, not legal perfection) so judges don’t have to trap you.

---

## Companion materials

| Doc | Use |
| --- | --- |
| [`PITCH.md`](../PITCH.md) | 30s / 90s / 3min variants |
| [`JUDGE_QA.md`](../JUDGE_QA.md) | Deep technical Qs |
| [`docs/INTEGRATOR.md`](./INTEGRATOR.md) | If a judge wants builder depth |
| npm `lien-sdk` | Install story in the close |
