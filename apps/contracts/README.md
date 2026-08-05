# Lien contracts

Hardhat package for on-chain encumbrance.

## EncumbranceRegistry

First-priority lien registry keyed by Lien **asset fingerprints** (`bytes32` keccak256 from `@repo/sdk`).

| Function | Behavior |
|----------|----------|
| `registerLien(fingerprint, lender)` | Records first lien; reverts `AlreadyEncumbered` if one exists |
| `isEncumbered(fingerprint)` | `true` if active lien |
| `getLien(fingerprint)` | `(lender, registeredAt, active)` |
| `getLender(fingerprint)` | Lender or `address(0)` |
| `releaseLien(fingerprint)` | Lender-only release; fingerprint becomes clean again |

Anyone may register (API relayer or wallet). Only the recorded **lender** may release.

## Commands

```bash
# from repo root
pnpm --filter contracts compile
pnpm --filter contracts test
pnpm --filter contracts deploy:hardhat
pnpm --filter contracts deploy:sepolia
```

Sepolia needs `apps/contracts/.env`:

```bash
SEPOLIA_RPC_URL=...
DEPLOYER_PRIVATE_KEY=...
```

Local node:

```bash
pnpm --filter contracts node
# other terminal
pnpm --filter contracts deploy:local
```

## Deployments

| Network | EncumbranceRegistry |
|---------|---------------------|
| Sepolia | `0xdF9e457964A25dD04167Ec5715e19eeB5AC6f71B` |

See `deployments/sepolia.json`.

## Next

Wire dual-write from `apps/api` finance path to `registerLien` (see monorepo roadmap).
