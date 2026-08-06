export type InvoiceFields = {
  issuerCvi: string;
  debtorCvi: string;
  documentHash: string;
  invoiceNumber: string;
  amount: string;
  currency: string;
  dueDate: string;
};

export type CreateFingerprintInput = InvoiceFields & {
  chain: string;
  issuerWallet: string;
  atokenAddress: string;
  debtorWallet?: string;
};

export type PartyVerification = {
  role: "issuer" | "lender";
  wallet: string;
  chain: string;
  atokenAddress: string;
  cvRecordId: string | null;
  tier: string | number | null;
  subTier: number | null;
  group: string | null;
  status: number;
  expirationTime: number | null;
  verifyCode: number;
  verifyMessage: string;
  verifiedAt: string;
};

export type AssetStatus =
  | "draft"
  | "fingerprinted"
  | "clean"
  | "encumbered"
  | "minted"
  | "financed"
  | "blocked";

export type Asset = {
  id: string;
  fingerprint: string;
  status: AssetStatus;
  fields: InvoiceFields;
  chain: string | null;
  issuerWallet: string | null;
  debtorWallet: string | null;
  atokenAddress: string | null;
  issuerVerification: PartyVerification | null;
  issuerCviVerifiedAt: string | null;
  cvaId: string | null;
  createdAt: string;
  updatedAt: string;
  isClean: boolean;
  activeLienId: string | null;
};

export type FingerprintResult = {
  id: string;
  fingerprint: string;
  status: AssetStatus;
  fields: InvoiceFields;
  isClean: boolean;
  existingLienId: string | null;
  issuerVerification: PartyVerification;
  createdAt: string;
};

export type EncumbranceResult = {
  fingerprint: string;
  isClean: boolean;
  status: AssetStatus;
  existingLienId: string | null;
  reason: string;
  asset: {
    id: string;
    status: AssetStatus;
    invoiceNumber: string;
  } | null;
  lien: {
    id: string;
    lenderCvi: string;
    priority: number;
    registeredAt: string;
  } | null;
};

export type FinanceInput = {
  fingerprint: string;
  lenderCvi: string;
  lenderWallet: string;
  chain?: string;
  atokenAddress?: string;
  cvaId?: string;
};

export type LienRecord = {
  id: string;
  lenderCvi: string;
  lenderWallet: string | null;
  lenderVerification: PartyVerification | null;
  lenderCviVerifiedAt: string | null;
  priority: number;
  status: "active" | "released";
  cvaId: string | null;
  txHash: string | null;
  settlementChain?: string | null;
  registeredAt: string;
};

export type OnChainLienResult =
  | {
      registered: true;
      txHash: string;
      explorerUrl: string;
      registryAddress: string;
      registrar: string;
      chainId: number;
      lender: string;
    }
  | {
      registered: false;
      reason: string;
    };

export type FinanceResult = {
  success: true;
  fingerprint: string;
  scope?: "global";
  asset: {
    id: string;
    status: AssetStatus;
    invoiceNumber: string;
    amount: string;
    currency: string;
    chain?: string | null;
  };
  lien: LienRecord;
  lenderVerification: PartyVerification;
  cleanverse: Record<string, unknown> | null;
  onChain?: OnChainLienResult | null;
};

export type AuditEventType =
  | "FINGERPRINT_CREATED"
  | "ENCUMBRANCE_CHECKED"
  | "CVA_MINTED"
  | "LIEN_REGISTERED"
  | "FINANCING_BLOCKED"
  | "CVI_VERIFIED"
  | "CVI_VERIFICATION_FAILED";

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  fingerprint: string | null;
  assetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FinancingBlockedPayload = {
  message?: string;
  code?: string;
  reason?: string;
  fingerprint?: string;
  scope?: "global";
  crossChain?: boolean;
  attemptedChain?: string;
  settlementChain?: string | null;
  source?: string;
  existingLien?: {
    id?: string;
    lenderCvi?: string;
    priority?: number;
    registeredAt?: string | number | null;
    cvaId?: string | null;
    txHash?: string | null;
    settlementChain?: string | null;
    lender?: string | null;
    registryAddress?: string | null;
  };
  lenderVerification?: PartyVerification | null;
};

export type DemoParty = {
  label: string;
  cvi: string;
  wallet: string | null;
};

export type DemoConfig = {
  ready: boolean;
  missing: string[];
  chain: string;
  conflictChain?: string;
  atokenAddress: string | null;
  parties: {
    issuer: DemoParty;
    lenderA: DemoParty;
    lenderB: DemoParty;
  };
  debtorCvi: string;
  scope?: "global";
  walletSource?: "browser" | "env";
};

export type DemoSeedResult = {
  seededAt: string;
  config: DemoConfig;
  invoice: InvoiceFields;
  fingerprint: FingerprintResult;
  registry: EncumbranceResult;
  firstFinance: FinanceResult;
  conflict: {
    attempted: boolean;
    blocked: boolean;
    code: string | null;
    message: string | null;
  };
  auditCount: number;
};
