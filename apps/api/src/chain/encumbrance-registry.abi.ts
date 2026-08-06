export const encumbranceRegistryAbi = [
  {
    type: "function",
    name: "registerLien",
    stateMutability: "nonpayable",
    inputs: [
      { name: "fingerprint", type: "bytes32" },
      { name: "lender", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "isEncumbered",
    stateMutability: "view",
    inputs: [{ name: "fingerprint", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "getLien",
    stateMutability: "view",
    inputs: [{ name: "fingerprint", type: "bytes32" }],
    outputs: [
      { name: "lender", type: "address" },
      { name: "registeredAt", type: "uint64" },
      { name: "active", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "getLender",
    stateMutability: "view",
    inputs: [{ name: "fingerprint", type: "bytes32" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "LienRegistered",
    inputs: [
      { name: "fingerprint", type: "bytes32", indexed: true },
      { name: "lender", type: "address", indexed: true },
      { name: "registrar", type: "address", indexed: true },
      { name: "registeredAt", type: "uint64", indexed: false },
    ],
  },
] as const;
