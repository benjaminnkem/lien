# LIEN — Demo script

Spoken script for the live demo. Conversational, not a product video.

**Surfaces**

| URL | Who | What |
| --- | --- | --- |
| `/` | Everyone | Story + pitch |
| `/demo` | **Supplier** | Prepare → register → **share passport link** |
| `/o/0x…` | **Obligor** (then anyone) | Sign & confirm → finance A → attack B → repay |

**Total time (live path):** ~5–7 minutes including wallet confirms.  
**Fast path if wallets flake:** open a pre-registered `/o/0x…` you prepared offline, jump to confirm/finance.

No em dashes in spoken lines below (use periods, commas, or “to”).

---

## Before you walk up (60s silent)

- [ ] Hosted web + API up; `/demo` shows **LienGuard ready**  
- [ ] Trust mode known (`live` or `demo`)  
- [ ] MetaMask on **Sepolia**, two profiles or accounts: **Supplier** + **Obligor**, both with a little ETH  
- [ ] Prefer **two browser profiles** (Chrome profiles or one normal + one private) so you never switch accounts mid-tab  
- [ ] Optional: DemoFinanceA has demo liquidity (if A reverts on “insufficient,” top up offline once)  
- [ ] Fresh invoice ref / prepare if you already encumbered this ID earlier today  
- [ ] Optional backup: a known passport URL from a dry run sitting in notes  

**Decide the path:**

| Situation | Use |
| --- | --- |
| Full story, multi-party | **Supplier on `/demo` → share → obligor on `/o/[id]`** |
| MetaMask dying on account switch | **Skip switching.** Open passport in second window with obligor wallet already connected |
| Time crunch | Land on a **pre-registered** `/o/0x…` and do confirm → A → B only |

Do not apologize into the demo. If you cut a step:  
> “I’ll jump to the passport so we stay on the claim story, not wallet UX.”

---

## Opening (landing → demo) · ~30–40s

*On `/` or as you click into `/demo`:*

> Blockchains are really good at one thing: you can’t spend the same token twice.  
> What they’re *not* good at is the asset *under* the token.  
> Same invoice. Two different PDFs. Two lending apps. Both think they’re first.  
> **LIEN is the control plane that makes that fail on-chain, before the second funder sends money.**

*Click **Demo** / open `/demo`.*

> Control room. Supplier starts here: prepare the claim, register it, share a link.  
> The obligor never has to fight over the same MetaMask account on this page.

---

## Live path (preferred)

### 1 · Frame the scene · ~20s

*Point at **Live · Sepolia · supplier start**.*

> Two parties. **Supplier** wants financing on a receivable. **Obligor** is the buyer who actually owes the money.  
> Lenders are separate adapters. They must ask **LienGuard** for exclusive access before funds move.

*Connect **supplier** wallet. Confirm Sepolia / contracts ready.*

> Public testnet. Real txs, real signatures.

---

### 2 · Insight while preparing · ~25s

*Fill obligor address (second wallet). Click **Prepare terms**.*

> Most systems fingerprint the PDF. Change a margin, change the hash, look like a new asset.  
> We fingerprint the **economic obligation**: who is owed, who owes, how much, when, which refs.  
> Document hash is for audit. It does **not** mint a new Obligation ID.

*Point at Obligation ID when it appears.*

> Same economics, same ID. That’s the whole trick.

---

### 3 · Register as supplier · ~30–45s

*Connected account must be **supplier**. Click **Register as supplier**. Confirm MetaMask.*

> Supplier publishes terms on-chain. Registration alone is not financeable.  
> We still need the obligor to own the economic deal.

*If CVI / trust live gates show:*

> Where Cleanverse is configured, identity gates who may participate. We don’t fake that on live paths.

---

### 4 · Share the passport · ~20–30s

*After register, the green **Share with obligor** strip appears. Copy link or **Open passport**.*

> Here’s the multi-party handoff.  
> Passport URL is `/o/` plus the Obligation ID. Terms load from chain.  
> Obligor opens this on their own browser. No account switch theater.

*Open `/o/0x…` in the second profile (obligor already connected) or hand the link to a co-presenter.*

> Shared claim surface. Status, parties, face value, then the next legal action for this state.

---

### 5 · Obligor signs and confirms · ~45–70s

*On `/o/[id]`. Connect as **obligor** (must match the obligor field). Prefer **Sign & confirm (obligor)**.*

> This is the obligor saying: those economic terms are mine.  
> EIP-712, domain-bound to this registry and chain. Not a free-form “I agree” string.

*If MetaMask hangs: open the extension, clear pending, retry. Optional fallback: **Sign only**, then **Submit confirm tx**.*

> After confirm, the claim is financeable. One passport, one exclusive claim slot.

*Refresh if needed. Badge should show confirmed / Verified (or equivalent).*

---

### 6 · Protocol A finances · ~30–45s

*Still on passport (any connected wallet that can call the adapter). **Finance · Protocol A**.*

> Protocol A is one financing venue. It calls LienGuard: reserve, move demo settlement, activate.  
> Atomic. If funding fails, the reservation does not stick half-done.

*State → **Encumbered**. Point at secured amount / controller if visible.*

> Claim is live.

---

### 7 · The kill shot · Protocol B · ~30–40s

***Attack · Protocol B**.*

> Same obligation. Independent adapter. B thinks it can fund too.  
> This should **fail before funds move**.

*On blocked toast / revert:*

> That’s the product. Not “we emailed compliance later.”  
> **On-chain exclusive claim. Second protocol out.**

*Optional closer line:*

> Chains stop double-spending the token. Until something like this, nothing stopped two loans on the same invoice.

---

### 8 · Discharge · ~20–30s (if time)

***Repay & discharge**.*

> Debtor pays, controller discharges. **Discharged**. History stays.  
> You can refinance under the rules later. You cannot pretend the first claim never happened.

---

### 9 · Soft close · ~20s

> Builders: integrate LienGuard like an oracle. Call it before you fund.  
> SDK is public: `npm install lien-sdk`. Sepolia addresses ship in the package.  
> Honesty line: this is **protocol-level** encumbrance for integrated systems, not universal legal lien perfection in every jurisdiction.  
> Happy to take questions.

---

## Fast path (wallets flaky or short slot)

1. Offline: supplier already registered; you have `/o/0x…` ready.  
2. Open passport with obligor → **Sign & confirm**.  
3. **Finance A** → **Attack B** (the money shot).  
4. Skip discharge if the clock is red.

Spoken bridge:

> I’ve already registered a live obligation so we can spend the minutes on confirmation and the double-finance block.

---

## Timing cheat sheet

| Block | Full live | Fast path |
| --- | --- | --- |
| Open + problem | 0:40 | 0:30 |
| Insight + prepare | 0:30 | — |
| Register + share | 0:50 | — |
| Obligor sign + confirm | 1:00 | 0:50 |
| Protocol A | 0:40 | 0:35 |
| Protocol B blocked | 0:35 | 0:35 |
| Discharge + close | 0:40 | 0:25 |
| **~Total** | **~5–7 min** | **~3 min** |

Leave **1–2 minutes** for questions in a 7-minute slot.

---

## If something breaks

| Symptom | Line | Move |
| --- | --- | --- |
| MetaMask stuck on sign | “Wallet queue, not the protocol. Clearing pending and retrying on the passport.” | Clear MetaMask queue; second profile; Sign only then Confirm |
| Wrong account for obligor | “Signature must come from the obligor address on the terms.” | Switch to obligor on passport only |
| Wrong chain | “Need Sepolia for this deploy.” | Switch network |
| Already encumbered | “This ID is already claimed. Fresh prepare and register.” | New invoice ref on `/demo` |
| Protocol A reverts (liquidity) | “Adapter plumbing, not the mutex.” | Retry A or demo B-fail on a known encumbered passport |
| CVI gate | “Identity gate failed the way it should for an unverified party.” | Use configured identities or explain trust mode |
| Obligation not found on `/o/…` | “Share after register so terms exist on-chain.” | Finish register; refresh passport |
| Explorer lag | “Tx submitted; state will catch up.” | Narrate the intended transition |

**Removed:** operator API seed / Hardhat panel on `/demo`. Fallback is a pre-made passport URL or contract tests offline (`pnpm test` in contracts), not a second UI path.

---

## What each button means (say only if asked)

| Action | Meaning |
| --- | --- |
| **Prepare terms** | Local/API build of economic terms + Obligation ID. No claim yet. |
| **Register as supplier** | On-chain publish. Not financeable until obligor confirms. |
| **Share / Open passport** | `/o/{id}` loads terms from chain for the other party. |
| **Sign & confirm** | Obligor EIP-712 + on-chain confirm → financeable. |
| **Finance · Protocol A** | Exclusive reserve + fund + activate → Encumbered. |
| **Attack · Protocol B** | Second venue; should revert if A holds the claim. |
| **Repay & discharge** | Release exclusive claim; history retained. |

---

## One-breath answers

**“Is this a legal lien registry?”**  
> No. Protocol-level exclusive claim for systems that integrate LienGuard.

**“Why not just hash the invoice?”**  
> Hashes track files. Attackers regenerate files. Lenders care about economics.

**“What does Cleanverse do?”**  
> Who is allowed to participate. LienGuard still decides who holds the claim.

**“What if two protocols race?”**  
> First successful reserve wins. Second reverts. Atomic in the adapter.

**“Why a separate passport URL?”**  
> Multi-party without switching MetaMask accounts mid-flow. Obligor opens their own session.

**“Cross-chain?”**  
> Cross-protocol today. Same ID model can extend. The mock is not a bridge.

**“Where’s the code for integrators?”**  
> `lien-sdk` on npm: `LienClient`, ABIs, Sepolia deployments.

---

## Lines to avoid

- “We perfected liens worldwide.”  
- “This replaces banks / UCC filings.”  
- “dUSDC is real dollars.”  
- “Cross-chain bridge is production-ready.”  
- Long architecture lectures before the B-fail moment.  
- “Just switch accounts on the same page” as the happy path (use the passport).

---

## Rehearsal checklist (day-of)

1. Full path once: `/demo` supplier → share → second profile `/o/…` → A → B.  
2. Fast path once from a saved passport URL.  
3. Practice the **B-fail sentence** until it sounds casual.  
4. Practice the **honesty line** (protocol-level, not legal perfection).  
5. Know how to clear a stuck MetaMask request in under 10 seconds.

---

## Companion materials

| Doc | Use |
| --- | --- |
| [`PITCH.md`](../PITCH.md) | 30s / 90s / 3min variants |
| [`JUDGE_QA.md`](../JUDGE_QA.md) | Deep technical Qs |
| [`docs/INTEGRATOR.md`](./INTEGRATOR.md) | Builder depth |
| npm `lien-sdk` | Install story in the close |
