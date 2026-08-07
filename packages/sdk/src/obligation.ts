import {
  keccak256,
  stringToHex,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";

/**
 * Canonical economic terms for a LIEN obligation.
 * evidenceRoot is stored with the obligation but is NOT part of the identity hash,
 * so two different PDF binaries can share one Obligation ID.
 */
export type ObligationTerms = {
  supplier: Address;
  obligor: Address;
  currency: string;
  faceValue: bigint;
  dueDate: number;
  invoiceReference: string;
  purchaseOrderReference: string;
  evidenceRoot: Hex;
  jurisdiction: string;
  version: bigint;
  nonce: Hex;
};

export const OBLIGATION_EIP712_TYPES = {
  ObligationTerms: [
    { name: "supplier", type: "address" },
    { name: "obligor", type: "address" },
    { name: "currency", type: "string" },
    { name: "faceValue", type: "uint256" },
    { name: "dueDate", type: "uint64" },
    { name: "invoiceReference", type: "string" },
    { name: "purchaseOrderReference", type: "string" },
    { name: "jurisdiction", type: "string" },
    { name: "version", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export function evidenceRootFromBytes(content: string | Uint8Array): Hex {
  if (typeof content === "string") {
    return keccak256(stringToHex(content));
  }
  return keccak256(content);
}

/** Off-chain economic fingerprint used for demos (matches contract identity fields). */
export function economicIdentityKey(terms: ObligationTerms): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "address, address, string, uint256, uint64, string, string, string, uint256, bytes32",
      ),
      [
        terms.supplier,
        terms.obligor,
        terms.currency,
        terms.faceValue,
        BigInt(terms.dueDate),
        terms.invoiceReference,
        terms.purchaseOrderReference,
        terms.jurisdiction,
        terms.version,
        terms.nonce,
      ],
    ),
  );
}

export function eip712Domain(params: {
  chainId: number;
  verifyingContract: Address;
}) {
  return {
    name: "LIEN ObligationRegistry",
    version: "1",
    chainId: params.chainId,
    verifyingContract: params.verifyingContract,
  } as const;
}

export function signableTerms(terms: ObligationTerms) {
  return {
    supplier: terms.supplier,
    obligor: terms.obligor,
    currency: terms.currency,
    faceValue: terms.faceValue,
    dueDate: BigInt(terms.dueDate),
    invoiceReference: terms.invoiceReference,
    purchaseOrderReference: terms.purchaseOrderReference,
    jurisdiction: terms.jurisdiction,
    version: terms.version,
    nonce: terms.nonce,
  };
}

export const LIEN_STATE_LABELS = [
  "Unregistered",
  "Verified",
  "Reserved",
  "Encumbered",
  "Discharged",
  "Cancelled",
  "Defaulted",
  "Disputed",
] as const;

export function lienStateLabel(state: number): string {
  return LIEN_STATE_LABELS[state] ?? `Unknown(${state})`;
}

/** Machine-readable reason codes (mirror LienGuard constants). */
export const LIEN_REASON_CODES = {
  RESERVATION_CONFLICT: 1,
  ASSET_ALREADY_ENCUMBERED: 2,
  OBLIGATION_NOT_VERIFIED: 3,
  RESERVATION_EXPIRED: 4,
  CLEARANCE_REPLAY: 5,
  IDENTITY_NOT_ELIGIBLE: 6,
  COMPLIANCE_BLOCKED: 7,
} as const;

export const LIEN_REASON_LABELS: Record<number, string> = {
  1: "RESERVATION_CONFLICT",
  2: "ASSET_ALREADY_ENCUMBERED",
  3: "OBLIGATION_NOT_VERIFIED",
  4: "RESERVATION_EXPIRED",
  5: "CLEARANCE_REPLAY",
  6: "IDENTITY_NOT_ELIGIBLE",
  7: "COMPLIANCE_BLOCKED",
};

export function lienReasonLabel(code: number): string {
  return LIEN_REASON_LABELS[code] ?? `UNKNOWN_REASON(${code})`;
}

export type LienClearanceView = {
  obligationId: string;
  protocol: string;
  chainId: string;
  financingAmount: string;
  reservationId: string;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
  active: boolean;
  consumed: boolean;
  identityChecksHash?: string;
  evidenceHash?: string;
};
