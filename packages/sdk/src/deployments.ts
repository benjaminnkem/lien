/**
 * Known public deployments of the LIEN stack.
 * Addresses are for integrator convenience — always verify against your env / explorer.
 */

export type LienDeployment = {
  network: string;
  chainId: number;
  explorer: string;
  contracts: {
    ObligationRegistry: `0x${string}`;
    LienGuard: `0x${string}`;
    MockSettlementToken: `0x${string}`;
    DemoFinanceA: `0x${string}`;
    DemoFinanceB: `0x${string}`;
    PriorityClaimBook: `0x${string}`;
    CrossChainClearanceMock: `0x${string}`;
  };
};

/** Ethereum Sepolia (hackathon / public testnet) */
export const SEPOLIA_DEPLOYMENT: LienDeployment = {
  network: "sepolia",
  chainId: 11155111,
  explorer: "https://sepolia.etherscan.io",
  contracts: {
    ObligationRegistry: "0xD7cB2f67434eFfa6e78eaed221C71E9Bd5500f9C",
    LienGuard: "0x70451CFb4182537CeC9781910C5538e8EFCEFdF7",
    MockSettlementToken: "0x79037a0722985B2E2Cf66ADba9ebf6937d67123C",
    DemoFinanceA: "0xDffB1Ba961a1e13c5D4955DdA2FeC6C93dbAbCcF",
    DemoFinanceB: "0xaFBC2BB2396A66720Bea47933e2a38E01e34da70",
    PriorityClaimBook: "0xf94295CD7CcF71A40b17511cA489374c61A02973",
    CrossChainClearanceMock: "0xd460cF41d4EB8EA8e1529Ed9785926dD9e7c8CD1",
  },
};

export const DEPLOYMENTS = {
  sepolia: SEPOLIA_DEPLOYMENT,
} as const;

export function getDeployment(
  chainId: number,
): LienDeployment | undefined {
  return Object.values(DEPLOYMENTS).find((d) => d.chainId === chainId);
}
