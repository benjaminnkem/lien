"use client";

import { useCallback } from "react";
import {
  useAccount,
  usePublicClient,
  useWalletClient,
  useWriteContract,
  useSignTypedData,
  useSwitchChain,
} from "wagmi";
import { sepolia } from "wagmi/chains";
import {
  type Address,
  type Hex,
  keccak256,
  stringToHex,
  parseAbiParameters,
  encodeAbiParameters,
} from "viem";
import {
  OBLIGATION_EIP712_TYPES,
  eip712Domain,
  evidenceRootFromBytes,
  signableTerms,
} from "@repo/sdk";
import {
  demoFinanceLiveAbi,
  obligationRegistryLiveAbi,
  priorityBookLiveAbi,
  settlementTokenLiveAbi,
  xchainMockLiveAbi,
} from "@/lib/lien-abis";
import {
  getLienPublicConfig,
  isLienConfigReady,
  type LienPublicConfig,
} from "@/lib/lien-config";

export type PreparedTerms = {
  supplier: Address;
  obligor: Address;
  currency: string;
  faceValue: bigint;
  dueDate: number;
  invoiceReference: string;
  purchaseOrderReference: string;
  evidenceRoot: Hex;
  jurisdiction: string;
  version: bigint;
  nonce: Hex;
};

export function useLienWallet(configOverride?: Partial<LienPublicConfig>) {
  const base = getLienPublicConfig();
  const config: LienPublicConfig = { ...base, ...configOverride };
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient({ chainId: config.chainId });
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();
  const { switchChainAsync } = useSwitchChain();

  const ensureChain = useCallback(async () => {
    if (chainId !== config.chainId) {
      await switchChainAsync({ chainId: config.chainId as typeof sepolia.id });
    }
  }, [chainId, config.chainId, switchChainAsync]);

  const buildTerms = useCallback(
    (input: {
      supplier: Address;
      obligor: Address;
      currency?: string;
      faceValue: string | bigint;
      dueDate: number;
      invoiceReference: string;
      purchaseOrderReference?: string;
      evidenceContent: string;
      jurisdiction?: string;
      nonce?: Hex;
    }): PreparedTerms => {
      const nonce =
        input.nonce ??
        (keccak256(
          stringToHex(
            `${input.invoiceReference}:${input.supplier}:${Date.now()}`,
          ),
        ) as Hex);
      return {
        supplier: input.supplier,
        obligor: input.obligor,
        currency: (input.currency ?? "USD").toUpperCase(),
        faceValue: BigInt(input.faceValue),
        dueDate: input.dueDate,
        invoiceReference: input.invoiceReference,
        purchaseOrderReference: input.purchaseOrderReference ?? "",
        evidenceRoot: evidenceRootFromBytes(input.evidenceContent),
        jurisdiction: input.jurisdiction ?? "SG",
        version: BigInt(1),
        nonce,
      };
    },
    [],
  );

  const toChainTerms = useCallback((terms: PreparedTerms) => {
    return {
      ...terms,
      dueDate: BigInt(terms.dueDate),
    };
  }, []);

  const computeObligationId = useCallback(
    async (terms: PreparedTerms) => {
      if (!publicClient || !config.registry) throw new Error("Not ready");
      return publicClient.readContract({
        address: config.registry,
        abi: obligationRegistryLiveAbi,
        functionName: "obligationId",
        args: [toChainTerms(terms)],
      }) as Promise<Hex>;
    },
    [publicClient, config.registry, toChainTerms],
  );

  const registerAsSupplier = useCallback(
    async (terms: PreparedTerms) => {
      if (!config.registry) throw new Error("Registry not configured");
      if (!address) throw new Error("Connect wallet");
      if (address.toLowerCase() !== terms.supplier.toLowerCase()) {
        throw new Error("Connected wallet must be the supplier");
      }
      await ensureChain();
      const hash = await writeContractAsync({
        address: config.registry,
        abi: obligationRegistryLiveAbi,
        functionName: "register",
        args: [toChainTerms(terms)],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [
      address,
      config.registry,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
      toChainTerms,
    ],
  );

  const signAsObligor = useCallback(
    async (terms: PreparedTerms) => {
      if (!config.registry) throw new Error("Registry not configured");
      if (!address) throw new Error("Connect wallet");
      if (address.toLowerCase() !== terms.obligor.toLowerCase()) {
        throw new Error("Connected wallet must be the obligor");
      }
      await ensureChain();
      const domain = eip712Domain({
        chainId: config.chainId,
        verifyingContract: config.registry,
      });
      const signature = await signTypedDataAsync({
        domain,
        types: OBLIGATION_EIP712_TYPES,
        primaryType: "ObligationTerms",
        message: signableTerms({
          ...terms,
          evidenceRoot: terms.evidenceRoot,
        }),
      });
      return signature as Hex;
    },
    [address, config.registry, config.chainId, ensureChain, signTypedDataAsync],
  );

  const confirmWithSignature = useCallback(
    async (terms: PreparedTerms, obligorSignature: Hex) => {
      if (!config.registry) throw new Error("Registry not configured");
      if (!address) throw new Error("Connect wallet");
      await ensureChain();
      const hash = await writeContractAsync({
        address: config.registry,
        abi: obligationRegistryLiveAbi,
        functionName: "confirm",
        args: [toChainTerms(terms), obligorSignature],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [
      address,
      config.registry,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
      toChainTerms,
    ],
  );

  const finance = useCallback(
    async (input: {
      protocol: "A" | "B";
      obligationId: Hex;
      borrower: Address;
      amount: bigint;
      reservationSeconds?: number;
    }) => {
      const protocol =
        input.protocol === "A" ? config.protocolA : config.protocolB;
      if (!protocol) throw new Error(`Protocol ${input.protocol} not configured`);
      if (!address) throw new Error("Connect wallet");
      await ensureChain();
      const expiry = BigInt(
        Math.floor(Date.now() / 1000) + (input.reservationSeconds ?? 3600),
      );
      const hash = await writeContractAsync({
        address: protocol,
        abi: demoFinanceLiveAbi,
        functionName: "finance",
        args: [input.obligationId, input.borrower, input.amount, expiry],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [
      address,
      config.protocolA,
      config.protocolB,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
    ],
  );

  const repay = useCallback(
    async (input: {
      protocol: "A" | "B";
      obligationId: Hex;
      amount: bigint;
    }) => {
      const protocol =
        input.protocol === "A" ? config.protocolA : config.protocolB;
      if (!protocol || !config.settlementToken) {
        throw new Error("Protocol/token not configured");
      }
      if (!address) throw new Error("Connect wallet");
      await ensureChain();
      // Demo token allows public mint for testnet repay convenience
      try {
        const mintHash = await writeContractAsync({
          address: config.settlementToken,
          abi: settlementTokenLiveAbi,
          functionName: "mint",
          args: [address, input.amount],
          chainId: config.chainId,
        });
        await publicClient?.waitForTransactionReceipt({ hash: mintHash });
      } catch {
        /* may already hold balance */
      }
      const approveHash = await writeContractAsync({
        address: config.settlementToken,
        abi: settlementTokenLiveAbi,
        functionName: "approve",
        args: [protocol, input.amount],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash: approveHash });
      const repaymentRef = keccak256(
        stringToHex(`repay:${input.obligationId}:${Date.now()}`),
      ) as Hex;
      const hash = await writeContractAsync({
        address: protocol,
        abi: demoFinanceLiveAbi,
        functionName: "repay",
        args: [input.obligationId, address, input.amount, repaymentRef],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [
      address,
      config.protocolA,
      config.protocolB,
      config.settlementToken,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
    ],
  );

  const registerSubordinate = useCallback(
    async (input: {
      obligationId: Hex;
      priorityRank: number;
      amount: bigint;
      label?: string;
    }) => {
      if (!config.priorityBook) throw new Error("Priority book not configured");
      if (!address) throw new Error("Connect wallet");
      await ensureChain();
      const claimRef = keccak256(
        stringToHex(`sub:${input.obligationId}:${Date.now()}`),
      ) as Hex;
      const hash = await writeContractAsync({
        address: config.priorityBook,
        abi: priorityBookLiveAbi,
        functionName: "registerSubordinate",
        args: [
          input.obligationId,
          input.priorityRank,
          input.amount,
          claimRef,
          input.label ?? `junior-${input.priorityRank}`,
        ],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return hash;
    },
    [
      address,
      config.priorityBook,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
    ],
  );

  const postXchain = useCallback(
    async (input: { obligationId: Hex; targetChainId?: number }) => {
      if (!config.crossChainMock) throw new Error("Xchain mock not configured");
      if (!address) throw new Error("Connect wallet");
      await ensureChain();
      const clearanceHash = keccak256(
        stringToHex(`xchain:${input.obligationId}:${Date.now()}`),
      ) as Hex;
      const hash = await writeContractAsync({
        address: config.crossChainMock,
        abi: xchainMockLiveAbi,
        functionName: "postClearance",
        args: [
          input.obligationId,
          BigInt(input.targetChainId ?? 10142),
          clearanceHash,
        ],
        chainId: config.chainId,
      });
      await publicClient?.waitForTransactionReceipt({ hash });
      return { hash, clearanceHash };
    },
    [
      address,
      config.crossChainMock,
      config.chainId,
      ensureChain,
      writeContractAsync,
      publicClient,
    ],
  );

  const readLiquidity = useCallback(
    async (protocol: "A" | "B") => {
      const p = protocol === "A" ? config.protocolA : config.protocolB;
      if (!publicClient || !p) return null;
      return publicClient.readContract({
        address: p,
        abi: demoFinanceLiveAbi,
        functionName: "liquidity",
      });
    },
    [publicClient, config.protocolA, config.protocolB],
  );

  return {
    config,
    ready: isLienConfigReady(config),
    address: address ?? null,
    isConnected,
    chainId,
    walletClient,
    publicClient,
    buildTerms,
    computeObligationId,
    registerAsSupplier,
    signAsObligor,
    confirmWithSignature,
    finance,
    repay,
    registerSubordinate,
    postXchain,
    readLiquidity,
    ensureChain,
    /** Deterministic economic identity key (off-chain helper). */
    economicKey: (terms: PreparedTerms) =>
      keccak256(
        encodeAbiParameters(
          parseAbiParameters(
            "address, address, string, uint256, uint64, string, string, string, uint256, bytes32",
          ),
          [
            terms.supplier,
            terms.obligor,
            terms.currency,
            terms.faceValue,
            BigInt(terms.dueDate),
            terms.invoiceReference,
            terms.purchaseOrderReference,
            terms.jurisdiction,
            terms.version,
            terms.nonce,
          ],
        ),
      ),
  };
}
