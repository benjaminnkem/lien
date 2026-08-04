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

export type CleanverseEnvelope<T = unknown> = {
  code: string;
  message: string;
  data: T;
};

export type ComplianceRule = {
  allowed_group: string;
  allowed_sub_group: string;
  min_tier: number;
  min_sub_tier: number;
  is_black_list?: boolean;
  countries?: string[];
};

export type WalletInput = {
  address: string;
  chain: CleanverseChain;
};

export type IdentityDataInput = {
  idType:
    | "ID_CARD"
    | "PASSPORT"
    | "DRIVER_LICENSE"
    | "HK_MACAO_TAIWAN_PASS"
    | "RESIDENCE_PERMIT"
    | string;
  fullName: string;
  idNumber?: string;
  validUntil?: string;
  issuingCountryISO2?: string;
};

export type BankAccountInput = {
  bankAccountType?: string;
  bankName?: string;
  accountNumber?: string;
  [key: string]: unknown;
};

export type GenerateApassRequest = {
  customerId: string;
  kycSource?: string;
  kycId?: string;
  subTier?: number;
  subGroup?: string;
  override?: boolean;
  expirationTime: number;
  wallet: WalletInput;
  identityDataList?: IdentityDataInput[];
  bankAccountList?: BankAccountInput[];
};

export type UpdateStatusRequest = {
  wallet: WalletInput;
  status: 1 | 2;
};

export type QueryApassRequest = {
  chain: CleanverseChain;
  address: string;
};

export type QueryApassData = {
  cvRecordId?: string;
  subTier?: number;
  tier?: string;
  status?: number;
  expirationTime?: number;
  subGroup?: string;
  currentKycHash?: string;
  group?: string;
  countries?: string[];
  [key: string]: unknown;
};

export type VerifyApassRequest = {
  chain: CleanverseChain;
  atoken: string;
  address: string;
};

export type VerifyApassData = {
  chain: string;
  atoken: string;
  address: string;
  code: number;
  message: string;
  magickLink?: string;
};

export type LaunchAtokenRequest = {
  chain: CleanverseChain;
  token_name: string;
  token_symbol: string;
  decimals: number;
  admin_address: string;
  rule: ComplianceRule;
  icon: string;
  callback_url?: string;
};

export type LaunchAtokenData = {
  requestId: string;
  issueAssetId?: number;
};

export type RegisterAtokenRequest = {
  chain: CleanverseChain;
  atoken_address: string;
  owner_signature: string;
  atoken_icon: string;
  callback_url?: string;
};

export type QueryApplyStatusData = {
  flowType?: string;
  requestId: string;
  applyStatus:
    | "PENDING"
    | "APPROVED"
    | "ISSUED"
    | "REJECTED"
    | "ISSUE_FAILED"
    | string;
  rejectReason?: string;
  issueErrorMsg?: string;
  chain?: string;
  atokenAddress?: string;
  originTokenAddress?: string;
  tokenSymbol?: string;
  txHash?: string;
  issuedAt?: string;
  callbackUrl?: string;
  callbackStatus?: string;
  callbackAttempts?: number;
  callbackLastError?: string;
  [key: string]: unknown;
};

export type QueryDepositAtokenListRequest = {
  chain: CleanverseChain;
  symbol?: string;
  address?: string;
};

export type TokenInfo = {
  address?: string;
  name?: string;
  symbol?: string;
  decimals?: number;
  icon?: string;
  [key: string]: unknown;
};

export type DepositAtokenListData = {
  chain: string;
  tokens: Array<{
    origin_token?: TokenInfo;
    atoken?: TokenInfo;
    accesscore_address?: string;
    apass_address?: string;
    [key: string]: unknown;
  }>;
};

export type AddAtokenRuleRequest = {
  chain: CleanverseChain;
  atoken_address: string;
  rule: ComplianceRule;
};

export type IsPausedRequest = {
  chain: CleanverseChain;
  atoken_address: string;
};

export type IsPausedData = {
  chain: string;
  paused: boolean;
  atoken_address: string;
};

export type SetPausedRequest = {
  chain: CleanverseChain;
  atoken_address: string;
  paused: boolean;
};

export type VerifyUserComplianceRequest = {
  chain: CleanverseChain;
  contract_address: string;
  user_address: string;
};

export type VerifyUserComplianceData = {
  chain: string;
  contract_address: string;
  user_address: string;
  valid: boolean;
};
