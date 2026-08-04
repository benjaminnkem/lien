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
  chain?: string;
  issuerWallet?: string;
  debtorWallet?: string;
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
  lenderWallet?: string;
  chain?: string;
  atokenAddress?: string;
  cvaId?: string;
  requireCleanverseVerify?: boolean;
};

export type LienRecord = {
  id: string;
  lenderCvi: string;
  lenderWallet: string | null;
  priority: number;
  status: "active" | "released";
  cvaId: string | null;
  txHash: string | null;
  registeredAt: string;
};

export type FinanceResult = {
  success: true;
  fingerprint: string;
  asset: {
    id: string;
    status: AssetStatus;
    invoiceNumber: string;
    amount: string;
    currency: string;
  };
  lien: LienRecord;
  cleanverse: Record<string, unknown> | null;
};

export type AuditEventType =
  | "FINGERPRINT_CREATED"
  | "ENCUMBRANCE_CHECKED"
  | "CVA_MINTED"
  | "LIEN_REGISTERED"
  | "FINANCING_BLOCKED"
  | "CVI_VERIFIED";

export type AuditEvent = {
  id: string;
  type: AuditEventType;
  fingerprint: string | null;
  assetId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type FinancingBlockedPayload = {
  code?: string;
  fingerprint?: string;
  existingLien?: {
    id: string;
    lenderCvi: string;
    priority: number;
    registeredAt: string;
    cvaId: string | null;
  };
};
