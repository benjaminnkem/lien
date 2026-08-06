export const SETTLEMENT_NETWORKS = [
  { value: "ethereum", label: "Ethereum (Sepolia UAT)" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "polygon", label: "Polygon" },
  { value: "monad", label: "Monad" },
  { value: "bsc", label: "BNB Chain" },
  { value: "avalanche", label: "Avalanche" },
] as const;

export function networkLabel(chain: string | null | undefined): string {
  if (!chain) return "unknown network";
  const match = SETTLEMENT_NETWORKS.find(
    (item) => item.value === chain.toLowerCase(),
  );
  return match?.label ?? chain;
}
