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
