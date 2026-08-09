import type { Address, Hex } from "viem";
import type { PreparedTerms } from "@/hooks/use-lien-wallet";

/** Serialized obligation from GET /lien/obligations/:id */
export type SerializedObligation = {
  obligationId: string;
  supplier: string;
  obligor: string;
  currency: string;
  faceValue: string;
  dueDate: number;
  invoiceReference: string;
  purchaseOrderReference: string;
  evidenceRoot: string;
  jurisdiction: string;
  version: string;
  nonce: string;
  confirmed: boolean;
  cancelled: boolean;
  registeredAt: number;
  confirmedAt: number;
};

export type ObligationStatusView = {
  state: number;
  stateLabel: string;
  claimController: string;
  securedAmount: string;
  reservedUntil?: number;
  activeReservationId?: string;
  financingRef?: string;
  repaymentRef?: string;
};

export type ObligationPassport = {
  obligation: SerializedObligation;
  status: ObligationStatusView;
};

export function normalizeObligationId(raw: string): Hex | null {
  const id = decodeURIComponent(raw).trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(id)) return null;
  return id as Hex;
}

export function obligationToTerms(o: SerializedObligation): PreparedTerms {
  return {
    supplier: o.supplier as Address,
    obligor: o.obligor as Address,
    currency: o.currency,
    faceValue: BigInt(o.faceValue),
    dueDate: o.dueDate,
    invoiceReference: o.invoiceReference,
    purchaseOrderReference: o.purchaseOrderReference ?? "",
    evidenceRoot: o.evidenceRoot as Hex,
    jurisdiction: o.jurisdiction,
    version: BigInt(o.version),
    nonce: o.nonce as Hex,
  };
}

export function shortHex(h?: string | null, n = 6) {
  if (!h) return "—";
  if (h.length <= n * 2 + 2) return h;
  return `${h.slice(0, 2 + n)}…${h.slice(-n)}`;
}

export function formatFaceValue(raw: string, currency = "USD") {
  try {
    const n = BigInt(raw);
    // Demo amounts are often 1e6 scaled (like dUSDC)
    const scale = BigInt(1_000_000);
    if (n >= scale && n % scale === BigInt(0)) {
      const whole = n / scale;
      return `${currency} ${whole.toLocaleString()}`;
    }
    return `${currency} ${n.toString()}`;
  } catch {
    return raw;
  }
}

export function stateBadgeClass(label?: string) {
  const s = (label ?? "").toLowerCase();
  if (s.includes("encumbered"))
    return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/40 dark:text-amber-100";
  if (s.includes("verified") || s.includes("discharged"))
    return s.includes("discharged")
      ? "border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100"
      : "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/40 dark:text-emerald-100";
  if (s.includes("reserved"))
    return "border-violet-300 bg-violet-50 text-violet-950 dark:border-violet-400/30 dark:bg-violet-950/40 dark:text-violet-100";
  return "border-border bg-muted/40 text-muted-foreground";
}
