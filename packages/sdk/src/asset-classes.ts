/**
 * P2 — extra RWA asset classes supported by the product model.
 * On-chain Obligation ID remains economic-terms based; assetClass is
 * protocol metadata for adapters/UI (not a legal asset taxonomy).
 */
export const ASSET_CLASSES = [
  "invoice",
  "warehouse_receipt",
  "purchase_order",
  "equipment",
  "private_credit",
] as const;

export type AssetClass = (typeof ASSET_CLASSES)[number];

export const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  invoice: "B2B Invoice / Receivable",
  warehouse_receipt: "Warehouse Receipt",
  purchase_order: "Purchase Order",
  equipment: "Equipment Claim",
  private_credit: "Private Credit Note",
};

export function isAssetClass(value: string): value is AssetClass {
  return (ASSET_CLASSES as readonly string[]).includes(value);
}

export function assetClassLabel(value: string): string {
  if (isAssetClass(value)) return ASSET_CLASS_LABELS[value];
  return value;
}
