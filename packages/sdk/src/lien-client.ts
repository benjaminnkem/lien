import type { Address, Hex, PublicClient } from "viem";
import {
  eip712Domain,
  OBLIGATION_EIP712_TYPES,
  signableTerms,
  type ObligationTerms,
  lienStateLabel,
  lienReasonLabel,
  LIEN_REASON_CODES,
} from "./obligation";

/** Minimal ABIs for read-only integrator use. */
export const lienRegistryReadAbi = [
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
] as const;

export const lienGuardReadAbi = [
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

export type LienClientConfig = {
  publicClient: PublicClient;
  registryAddress: Address;
  guardAddress: Address;
  chainId: number;
};

/**
 * Read-oriented integrator SDK for LIEN.
 * Use this from financing protocols instead of ad-hoc ABI copies.
 */
export class LienClient {
  constructor(private readonly config: LienClientConfig) {}

  get domain() {
    return eip712Domain({
      chainId: this.config.chainId,
      verifyingContract: this.config.registryAddress,
    });
  }

  get typedDataTypes() {
    return OBLIGATION_EIP712_TYPES;
  }

  toSignable(terms: ObligationTerms) {
    return signableTerms(terms);
  }

  toChainTerms(terms: ObligationTerms) {
    return {
      ...terms,
      dueDate: BigInt(terms.dueDate),
    };
  }

  async obligationId(terms: ObligationTerms): Promise<Hex> {
    return this.config.publicClient.readContract({
      address: this.config.registryAddress,
      abi: lienRegistryReadAbi,
      functionName: "obligationId",
      args: [this.toChainTerms(terms)],
    }) as Promise<Hex>;
  }

  async isFinanceable(obligationId: Hex): Promise<boolean> {
    return this.config.publicClient.readContract({
      address: this.config.registryAddress,
      abi: lienRegistryReadAbi,
      functionName: "isFinanceable",
      args: [obligationId],
    }) as Promise<boolean>;
  }

  async status(obligationId: Hex) {
    const raw = await this.config.publicClient.readContract({
      address: this.config.guardAddress,
      abi: lienGuardReadAbi,
      functionName: "status",
      args: [obligationId],
    });
    const state = Number(raw.state);
    return {
      state,
      stateLabel: lienStateLabel(state),
      claimController: raw.claimController as Address,
      securedAmount: raw.securedAmount.toString(),
      reservedUntil: Number(raw.reservedUntil),
      activeReservationId: raw.activeReservationId as Hex,
      financingRef: raw.financingRef as Hex,
      repaymentRef: raw.repaymentRef as Hex,
    };
  }

  async getClearance(reservationId: Hex) {
    const c = await this.config.publicClient.readContract({
      address: this.config.guardAddress,
      abi: lienGuardReadAbi,
      functionName: "getClearance",
      args: [reservationId],
    });
    return {
      obligationId: c.obligationId as Hex,
      protocol: c.protocol as Address,
      chainId: c.chainId.toString(),
      financingAmount: c.financingAmount.toString(),
      reservationId: c.reservationId as Hex,
      issuedAt: Number(c.issuedAt),
      expiresAt: Number(c.expiresAt),
      nonce: c.nonce.toString(),
      active: c.active,
      consumed: c.consumed,
    };
  }

  reasonLabel(code: number) {
    return lienReasonLabel(code);
  }

  get reasonCodes() {
    return LIEN_REASON_CODES;
  }
}

/** Claim-graph node for UI / export consumers. */
export type ClaimGraphNode = {
  id: string;
  kind:
    | "obligation"
    | "finance_success"
    | "finance_blocked"
    | "compliance_blocked"
    | "reservation_expired"
    | "discharged"
    | "other";
  label: string;
  outcome: string;
  reasonCode?: string | null;
  at?: string;
  meta?: Record<string, unknown>;
};

export type AuditLike = {
  id?: string;
  eventType: string;
  outcome: string;
  reasonCode?: string | null;
  createdAt?: string | Date;
  payload?: Record<string, unknown>;
};

/** Map audit events into a linear claim graph for the Obligation Passport UI. */
export function buildClaimGraph(events: AuditLike[]): ClaimGraphNode[] {
  return events.map((e, i) => {
    const eventType = e.eventType.toUpperCase();
    let kind: ClaimGraphNode["kind"] = "other";
    let label = e.eventType;

    if (eventType.includes("REGISTER") || eventType.includes("SEED")) {
      kind = "obligation";
      label = "Verified obligation";
    } else if (eventType.includes("COMPLIANCE")) {
      kind = "compliance_blocked";
      label = "Compliance blocked";
    } else if (
      eventType.includes("FINANCE_SUCCESS") ||
      eventType === "FINANCE_SUCCESS"
    ) {
      kind = "finance_success";
      label = `Protocol ${(e.payload?.protocol as string) ?? "A"} financed`;
    } else if (
      eventType.includes("FINANCE_BLOCKED") ||
      eventType.includes("FINANCE_BLOCK")
    ) {
      kind = "finance_blocked";
      label = `Protocol ${(e.payload?.protocol as string) ?? "B"} blocked`;
    } else if (
      eventType.includes("RESERVATION_CREATED") ||
      eventType === "RESERVATION_CREATED"
    ) {
      kind = "other";
      label = "Reservation created";
    } else if (eventType.includes("EXPIR")) {
      kind = "reservation_expired";
      label = "Reservation expired";
    } else if (eventType.includes("DISCHARGE")) {
      kind = "discharged";
      label = "Claim discharged";
    }

    return {
      id: e.id ?? `node-${i}`,
      kind,
      label,
      outcome: e.outcome,
      reasonCode: e.reasonCode,
      at:
        typeof e.createdAt === "string"
          ? e.createdAt
          : e.createdAt instanceof Date
            ? e.createdAt.toISOString()
            : undefined,
      meta: e.payload,
    };
  });
}

/** Flatten evidence pack / audit rows to CSV (header + rows). */
export function auditEventsToCsv(events: AuditLike[]): string {
  const header = ["createdAt", "eventType", "outcome", "reasonCode", "payload"];
  const lines = [header.join(",")];
  for (const e of events) {
    const created =
      typeof e.createdAt === "string"
        ? e.createdAt
        : e.createdAt instanceof Date
          ? e.createdAt.toISOString()
          : "";
    const payload = JSON.stringify(e.payload ?? {}).replaceAll('"', '""');
    lines.push(
      [
        created,
        e.eventType,
        e.outcome,
        e.reasonCode ?? "",
        `"${payload}"`,
      ].join(","),
    );
  }
  return lines.join("\n");
}
