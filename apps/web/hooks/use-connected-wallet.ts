"use client";

import { useAccount } from "wagmi";

export function useConnectedWallet() {
  const { address, isConnected, isConnecting, status, chain } = useAccount();

  return {
    address: address ?? null,
    isConnected,
    isConnecting,
    status,
    chain,
    chainId: chain?.id ?? null,
  };
}
