/**
 * Minimal ABIs for integrators (read + write surfaces).
 * Prefer these over copying from the monorepo web app.
 */

export const obligationRegistryAbi = [
  {
    type: "function",
    name: "register",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "terms",
        type: "tuple",
        components: [
          { name: "supplier", type: "address" },
          { name: "obligor", type: "address" },
          { name: "currency", type: "string" },
          { name: "faceValue", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "invoiceReference", type: "string" },
          { name: "purchaseOrderReference", type: "string" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "jurisdiction", type: "string" },
          { name: "version", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "confirm",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "terms",
        type: "tuple",
        components: [
          { name: "supplier", type: "address" },
          { name: "obligor", type: "address" },
          { name: "currency", type: "string" },
          { name: "faceValue", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "invoiceReference", type: "string" },
          { name: "purchaseOrderReference", type: "string" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "jurisdiction", type: "string" },
          { name: "version", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
      { name: "obligorSignature", type: "bytes" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "obligationId",
    stateMutability: "view",
    inputs: [
      {
        name: "terms",
        type: "tuple",
        components: [
          { name: "supplier", type: "address" },
          { name: "obligor", type: "address" },
          { name: "currency", type: "string" },
          { name: "faceValue", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "invoiceReference", type: "string" },
          { name: "purchaseOrderReference", type: "string" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "jurisdiction", type: "string" },
          { name: "version", type: "uint256" },
          { name: "nonce", type: "bytes32" },
        ],
      },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "isFinanceable",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "getObligation",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "obligationId", type: "bytes32" },
          { name: "supplier", type: "address" },
          { name: "obligor", type: "address" },
          { name: "currency", type: "string" },
          { name: "faceValue", type: "uint256" },
          { name: "dueDate", type: "uint64" },
          { name: "invoiceReference", type: "string" },
          { name: "purchaseOrderReference", type: "string" },
          { name: "evidenceRoot", type: "bytes32" },
          { name: "jurisdiction", type: "string" },
          { name: "version", type: "uint256" },
          { name: "nonce", type: "bytes32" },
          { name: "confirmed", type: "bool" },
          { name: "cancelled", type: "bool" },
          { name: "registeredAt", type: "uint64" },
          { name: "confirmedAt", type: "uint64" },
        ],
      },
    ],
  },
] as const;

export const lienGuardAbi = [
  {
    type: "function",
    name: "reserve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "financingAmount", type: "uint256" },
      { name: "expiry", type: "uint64" },
    ],
    outputs: [{ name: "reservationId", type: "bytes32" }],
  },
  {
    type: "function",
    name: "activate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "reservationId", type: "bytes32" },
      { name: "financingRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "discharge",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "repaymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "expireReservation",
    stateMutability: "nonpayable",
    inputs: [{ name: "obligationId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "status",
    stateMutability: "view",
    inputs: [{ name: "obligationId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "state", type: "uint8" },
          { name: "claimController", type: "address" },
          { name: "securedAmount", type: "uint256" },
          { name: "reservedUntil", type: "uint64" },
          { name: "activeReservationId", type: "bytes32" },
          { name: "financingRef", type: "bytes32" },
          { name: "repaymentRef", type: "bytes32" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "getClearance",
    stateMutability: "view",
    inputs: [{ name: "reservationId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "obligationId", type: "bytes32" },
          { name: "protocol", type: "address" },
          { name: "chainId", type: "uint256" },
          { name: "financingAmount", type: "uint256" },
          { name: "reservationId", type: "bytes32" },
          { name: "issuedAt", type: "uint64" },
          { name: "expiresAt", type: "uint64" },
          { name: "nonce", type: "uint256" },
          { name: "active", type: "bool" },
          { name: "consumed", type: "bool" },
        ],
      },
    ],
  },
] as const;
