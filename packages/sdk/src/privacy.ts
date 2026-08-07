import { keccak256, stringToHex, type Hex } from "viem";

/**
 * P2 — advanced privacy helpers for exports and UI redaction.
 * On-chain already stores roots/hashes, not full documents.
 */

export type PrivacyLevel = "public" | "redacted" | "commitments_only";

export function hashIdentifier(value: string): Hex {
  return keccak256(stringToHex(value.toLowerCase()));
}

export function redactAddress(address: string): string {
  if (!address || address.length < 10) return "0x…";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function redactHex(hex: string, keep = 6): string {
  if (!hex || hex.length < keep * 2) return hex;
  return `${hex.slice(0, 2 + keep)}…${hex.slice(-keep)}`;
}

/**
 * Produce a privacy-preserving view of an evidence pack / obligation dump.
 */
export function applyPrivacyFilter<T extends Record<string, unknown>>(
  data: T,
  level: PrivacyLevel = "redacted",
): Record<string, unknown> {
  if (level === "public") {
    return { ...data, privacyLevel: level };
  }

  const clone = JSON.parse(JSON.stringify(data)) as Record<string, unknown>;

  const scrub = (obj: unknown): unknown => {
    if (Array.isArray(obj)) return obj.map(scrub);
    if (!obj || typeof obj !== "object") return obj;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = k.toLowerCase();
      if (
        key.includes("document") ||
        key === "documenta" ||
        key === "documentb" ||
        key.includes("content") ||
        key === "statement"
      ) {
        if (level === "commitments_only") {
          out[k] = typeof v === "string" ? hashIdentifier(v) : "[redacted]";
        } else {
          out[k] = "[redacted]";
        }
        continue;
      }
      if (
        (key.includes("supplier") ||
          key.includes("obligor") ||
          key.includes("borrower") ||
          key.includes("protocol") ||
          key.includes("controller") ||
          key === "address") &&
        typeof v === "string" &&
        v.startsWith("0x") &&
        v.length === 42
      ) {
        out[k] =
          level === "commitments_only" ? hashIdentifier(v) : redactAddress(v);
        continue;
      }
      if (typeof v === "object") {
        out[k] = scrub(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  };

  return {
    ...(scrub(clone) as Record<string, unknown>),
    privacyLevel: level,
    privacyNote:
      "Redacted export for sharing. Full evidence remains off-chain under operator control.",
  };
}
