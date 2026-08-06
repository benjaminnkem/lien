export type CleanverseChain =
  | "solana"
  | "base"
  | "avalanche"
  | "arbitrum"
  | "ethereum"
  | "polygon"
  | "bsc"
  | "monad"
  | "hashkey"
  | "platon"
  | string;

export const LIEN_CLEANVERSE_CHAIN =
  "ethereum" as const satisfies CleanverseChain;

export const LIEN_EVM_CHAIN_ID = 11_155_111;

export const LIEN_EVM_NETWORK_LABEL = "Ethereum Sepolia";

export const LIEN_DEMO_ATOKEN_ADDRESS =
  "0xaC0893567D43C3E7e6e35a72803df05416C1f20D" as const;

export const LIEN_SETTLEMENT_NETWORKS = [
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "optimism",
  "monad",
  "bsc",
  "avalanche",
] as const;

export type LienSettlementNetwork = (typeof LIEN_SETTLEMENT_NETWORKS)[number];

export const LIEN_NETWORK_LABELS: Record<string, string> = {
  ethereum: "Ethereum (Sepolia in UAT)",
  base: "Base",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  optimism: "Optimism",
  monad: "Monad",
  bsc: "BNB Chain",
  avalanche: "Avalanche",
};

export function normalizeSettlementNetwork(
  chain: string | null | undefined,
): string | null {
  if (!chain) return null;
  return chain.trim().toLowerCase();
}

export function isCrossChainAttempt(
  settlementChain: string | null | undefined,
  attemptedChain: string | null | undefined,
): boolean {
  const settlement = normalizeSettlementNetwork(settlementChain);
  const attempted = normalizeSettlementNetwork(attemptedChain);
  if (!settlement || !attempted) return false;
  return settlement !== attempted;
}

export function formatNetworkLabel(chain: string | null | undefined): string {
  if (!chain) return "unknown network";
  const key = chain.trim().toLowerCase();
  return LIEN_NETWORK_LABELS[key] ?? chain;
}

export type CviRef = {
  chain: CleanverseChain;
  address: string;
  apassId?: string;
  group?: string;
  tier?: string | number;
};

export type CvaRef = {
  chain: CleanverseChain;
  atokenAddress: string;
  symbol?: string;
  requestId?: string;
};

export const VERIFY_APASS_CODE = {
  ATOKEN_NOT_FOUND: 1,
  NO_APASS: 2,
  APASS_BLOCKED: 3,
  OK: 4,
} as const;

export function isVerifyApassAllowed(code: number): boolean {
  return code === VERIFY_APASS_CODE.OK;
}

export function mapVerifyApassMessage(code: number): string {
  switch (code) {
    case VERIFY_APASS_CODE.ATOKEN_NOT_FOUND:
      return "A-Token not found";
    case VERIFY_APASS_CODE.NO_APASS:
      return "User does not have A-Pass (CVI)";
    case VERIFY_APASS_CODE.APASS_BLOCKED:
      return "A-Pass exists but cannot transfer (expired or frozen)";
    case VERIFY_APASS_CODE.OK:
      return "Valid A-Pass and transfer allowed";
    default:
      return `Unknown verify_apass code: ${code}`;
  }
}
