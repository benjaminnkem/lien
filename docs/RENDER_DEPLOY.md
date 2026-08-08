# Deploy LIEN API on Render

No Hardhat node is required. Contracts are on **Ethereum Sepolia**.

## 1. Create services

### Option A — Blueprint (recommended)

1. Push this repo to GitHub.
2. Render Dashboard → **New** → **Blueprint**.
3. Select the repo (uses root `render.yaml`).
4. Fill secrets marked `sync: false` (see env table below).
5. Apply.

### Option B — Manual Web Service

| Field | Value |
| --- | --- |
| **Runtime** | Node |
| **Root Directory** | leave empty (repo root) |
| **Build Command** | `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm --filter @repo/sdk build && pnpm --filter api build` |
| **Start Command** | `pnpm --filter api start:prod` |
| **Health Check Path** | `/api/health` |
| **Instance type** | Free or Starter |

Also create a **Render Postgres** instance and link `DATABASE_URL` to the web service.

---

## 2. Environment variables

Copy into Render → Web Service → Environment.

### Core

| Key | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `NODE_VERSION` | `20` |
| `PORT` | *(Render sets this — do not hardcode)* |
| `CORS_ORIGIN` | Your Vercel URL, e.g. `https://lien-xxx.vercel.app` (comma-separated if multiple) |

### Database (prefer Postgres on Render)

| Key | Value |
| --- | --- |
| `DATABASE_URL` | From Render Postgres (auto if linked) |
| `DATABASE_SSL` | `true` |
| `DATABASE_SYNC` | `true` for hackathon (creates tables) |

Avoid SQLite on Render free disk — it is ephemeral.

### LIEN / Sepolia (already deployed)

| Key | Value |
| --- | --- |
| `LIEN_ENABLED` | `true` |
| `LIEN_TRUST_MODE` | `live` |
| `LIEN_REQUIRE_CCP` | `false` |
| `LIEN_CHAIN_ID` | `11155111` |
| `LIEN_RPC_URL` | Your Sepolia RPC (Alchemy/Infura/public) |
| `LIEN_REGISTRY_ADDRESS` | `0xD7cB2f67434eFfa6e78eaed221C71E9Bd5500f9C` |
| `LIEN_GUARD_ADDRESS` | `0x70451CFb4182537CeC9781910C5538e8EFCEFdF7` |
| `LIEN_PROTOCOL_A_ADDRESS` | `0xDffB1Ba961a1e13c5D4955DdA2FeC6C93dbAbCcF` |
| `LIEN_PROTOCOL_B_ADDRESS` | `0xaFBC2BB2396A66720Bea47933e2a38E01e34da70` |
| `LIEN_TOKEN_ADDRESS` | `0x79037a0722985B2E2Cf66ADba9ebf6937d67123C` |
| `LIEN_PRIORITY_BOOK_ADDRESS` | `0xf94295CD7CcF71A40b17511cA489374c61A02973` |
| `LIEN_XCHAIN_MOCK_ADDRESS` | `0xd460cF41d4EB8EA8e1529Ed9785926dD9e7c8CD1` |
| `LIEN_PRIVATE_KEY` | Optional — only if you need server-side operator txs |

### Cleanverse (live CVI)

| Key | Value |
| --- | --- |
| `CLEANVERSE_BASE_URL` | `https://uatapi.cleanverse.com/api/cooperate` |
| `CLEANVERSE_API_ID` | your id |
| `CLEANVERSE_API_KEY` | your key |
| `DEMO_CHAIN` | `ethereum` |
| `DEMO_ATOKEN_ADDRESS` | `0xaC0893567D43C3E7e6e35a72803df05416C1f20D` |

---

## 3. After deploy

Service URL looks like:

`https://lien-api-xxxx.onrender.com`

Checks:

```bash
curl https://lien-api-xxxx.onrender.com/api/health
curl https://lien-api-xxxx.onrender.com/api/lien/status
```

Expect `ready: true`, `chainId: 11155111`.

Swagger: `https://lien-api-xxxx.onrender.com/api/docs`

---

## 4. Wire Vercel

On the **web** project set:

```bash
NEXT_PUBLIC_API_URL=https://lien-api-xxxx.onrender.com/api
```

Redeploy Vercel after changing this.

On Render, set `CORS_ORIGIN` to the Vercel origin (no trailing slash), e.g.:

```bash
CORS_ORIGIN=https://your-app.vercel.app
```

---

## 5. Free-tier notes

- Render free web services **spin down** after idle; first request can be slow (~30–60s).
- Free Postgres may sleep; cold starts apply.
- No Hardhat process is required for live Sepolia mode.
