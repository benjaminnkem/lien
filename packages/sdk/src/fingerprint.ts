import { keccak256, stringToHex, type Hex } from "viem";
import { InvoiceFieldsSchema, type InvoiceFields } from "./types";

export function canonicalizeInvoiceFields(fields: InvoiceFields): string {
  const parsed = InvoiceFieldsSchema.parse(fields);

  const parts = [
    parsed.issuerCvi.trim().toLowerCase(),
    parsed.debtorCvi.trim().toLowerCase(),
    parsed.documentHash.trim().toLowerCase(),
    parsed.invoiceNumber.trim().toUpperCase(),
    normalizeAmount(parsed.amount),
    parsed.currency.trim().toUpperCase(),
    parsed.dueDate.trim(),
  ];

  return parts.join("|");
}

function normalizeAmount(amount: string): string {
  const cleaned = amount.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    throw new Error(`Invalid amount: ${amount}`);
  }
  if (!cleaned.includes(".")) return cleaned;
  const [whole, frac = ""] = cleaned.split(".");
  const trimmedFrac = frac.replace(/0+$/, "");
  return trimmedFrac.length > 0 ? `${whole}.${trimmedFrac}` : whole!;
}

export function createAssetFingerprint(fields: InvoiceFields): Hex {
  const canonical = canonicalizeInvoiceFields(fields);
  return keccak256(stringToHex(canonical));
}
