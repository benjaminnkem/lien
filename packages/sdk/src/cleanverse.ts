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

/**
 * Lien demo runs entirely on Ethereum Sepolia.
 * Cleanverse UAT expects the network name `ethereum` for Sepolia (not "sepolia").
 */
export const LIEN_CLEANVERSE_CHAIN = "ethereum" as const satisfies CleanverseChain;

/** EVM chain id for Ethereum Sepolia */
export const LIEN_EVM_CHAIN_ID = 11_155_111;

/** Human-readable network label for UI */
export const LIEN_EVM_NETWORK_LABEL = "Ethereum Sepolia";

/**
 * Cleanverse UAT aUSDC on `ethereum` (Sepolia).
 * Used as the default demo A-Token for CVI verify_apass gates.
 */
export const LIEN_DEMO_ATOKEN_ADDRESS =
  "0xaC0893567D43C3E7e6e35a72803df05416C1f20D" as const;

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
