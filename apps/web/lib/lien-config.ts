import { sepolia } from "wagmi/chains";
import type { Address, Hex } from "viem";

export type LienPublicConfig = {
  chainId: number;
  chainName: string;
  mode: "live" | "demo";
  registry: Address | null;
  guard: Address | null;
  protocolA: Address | null;
  protocolB: Address | null;
  settlementToken: Address | null;
  priorityBook: Address | null;
  crossChainMock: Address | null;
  explorerBase: string;
};

function addr(raw: string | undefined): Address | null {
  if (!raw || !raw.startsWith("0x") || raw.length !== 42) return null;
  return raw as Address;
}

/**
 * Browser-side LIEN addresses + mode.
 * Prefer NEXT_PUBLIC_* for wallet writes. Falls back to API /lien/status at runtime.
 */
export function getLienPublicConfig(): LienPublicConfig {
  const modeEnv = (
    process.env.NEXT_PUBLIC_LIEN_MODE ?? "live"
  ).toLowerCase();
  const chainId = Number(
    process.env.NEXT_PUBLIC_LIEN_CHAIN_ID ?? sepolia.id,
  );
  const mode: "live" | "demo" =
    modeEnv === "demo" || chainId === 31337 ? "demo" : "live";

  return {
    chainId,
    chainName: chainId === sepolia.id ? "Ethereum Sepolia" : `chain ${chainId}`,
    mode,
    registry: addr(process.env.NEXT_PUBLIC_LIEN_REGISTRY_ADDRESS),
    guard: addr(process.env.NEXT_PUBLIC_LIEN_GUARD_ADDRESS),
    protocolA: addr(process.env.NEXT_PUBLIC_LIEN_PROTOCOL_A_ADDRESS),
    protocolB: addr(process.env.NEXT_PUBLIC_LIEN_PROTOCOL_B_ADDRESS),
    settlementToken: addr(process.env.NEXT_PUBLIC_LIEN_TOKEN_ADDRESS),
    priorityBook: addr(process.env.NEXT_PUBLIC_LIEN_PRIORITY_BOOK_ADDRESS),
    crossChainMock: addr(process.env.NEXT_PUBLIC_LIEN_XCHAIN_MOCK_ADDRESS),
    explorerBase:
      process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.etherscan.io",
  };
}

export function txUrl(explorerBase: string, hash: Hex | string) {
  return `${explorerBase}/tx/${hash}`;
}

export function isLienConfigReady(c: LienPublicConfig) {
  return Boolean(
    c.registry && c.guard && c.protocolA && c.protocolB && c.settlementToken,
  );
}
