/** Minimal ABIs for wallet-side LIEN writes (Sepolia / live). */

export const obligationRegistryLiveAbi = [
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
  {
    type: "function",
    name: "isFinanceable",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [{ type: "bool" }],
  },
] as const;

export const demoFinanceLiveAbi = [
  {
    type: "function",
    name: "finance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "borrower", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reservationExpiry", type: "uint64" },
    ],
    outputs: [
      { name: "reservationId", type: "bytes32" },
      { name: "financingRef", type: "bytes32" },
    ],
  },
  {
    type: "function",
    name: "repay",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "from", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "repaymentRef", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "liquidity",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const settlementTokenLiveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

export const priorityBookLiveAbi = [
  {
    type: "function",
    name: "registerSubordinate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "priorityRank", type: "uint8" },
      { name: "amount", type: "uint256" },
      { name: "claimRef", type: "bytes32" },
      { name: "label", type: "string" },
    ],
    outputs: [{ type: "bytes32" }],
  },
] as const;

export const xchainMockLiveAbi = [
  {
    type: "function",
    name: "postClearance",
    stateMutability: "nonpayable",
    inputs: [
      { name: "obligationId", type: "bytes32" },
      { name: "targetChainId", type: "uint256" },
      { name: "clearanceHash", type: "bytes32" },
    ],
    outputs: [{ type: "bytes32" }],
  },
  {
    type: "function",
    name: "consumeClearance",
    stateMutability: "nonpayable",
    inputs: [{ name: "recordId", type: "bytes32" }],
    outputs: [],
  },
] as const;
