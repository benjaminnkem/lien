import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  isHex,
  type Address,
  type Hash,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { encumbranceRegistryAbi } from "./encumbrance-registry.abi";
import {
  ChainAlreadyEncumberedError,
  ChainConfigError,
  ChainWriteError,
} from "./chain.errors";

export type OnChainLienProof = {
  fingerprint: string;
  lender: Address;
  registrar: Address;
  txHash: Hash;
  chainId: number;
  registryAddress: Address;
  explorerUrl: string;
};

export type OnChainLienView = {
  fingerprint: string;
  active: boolean;
  lender: Address | null;
  registeredAt: number | null;
  registryAddress: Address;
  chainId: number;
};

@Injectable()
export class ChainService {
  private readonly logger = new Logger(ChainService.name);
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;
  private registrarAddress: Address | null = null;

  constructor(private readonly config: ConfigService) {}

  get isEnabled(): boolean {
    return this.config.get<boolean>("chain.enabled") === true;
  }

  get isReady(): boolean {
    return (
      this.isEnabled &&
      Boolean(this.rpcUrl) &&
      Boolean(this.registryAddress) &&
      Boolean(this.privateKey)
    );
  }

  getStatus() {
    return {
      enabled: this.isEnabled,
      ready: this.isReady,
      chainId: this.chainId,
      registryAddress: this.registryAddress || null,
      rpcConfigured: Boolean(this.rpcUrl),
      privateKeyConfigured: Boolean(this.privateKey),
      registrar: this.registrarAddress,
    };
  }

  private get rpcUrl(): string {
    return this.config.get<string>("chain.rpcUrl") ?? "";
  }

  private get registryAddress(): Address | "" {
    const value = this.config.get<string>("chain.registryAddress") ?? "";
    return value as Address | "";
  }

  private get privateKey(): Hex | "" {
    const raw = this.config.get<string>("chain.privateKey") ?? "";
    if (!raw) return "";
    return (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex;
  }

  private get chainId(): number {
    return this.config.get<number>("chain.chainId") ?? sepolia.id;
  }

  private assertReady() {
    if (!this.isEnabled) {
      throw new ChainConfigError("On-chain dual-write is disabled");
    }
    if (!this.rpcUrl) {
      throw new ChainConfigError(
        "CHAIN_RPC_URL or SEPOLIA_RPC_URL is required when CHAIN_ENABLED=true",
      );
    }
    if (!this.registryAddress || !isAddress(this.registryAddress)) {
      throw new ChainConfigError(
        "ENCUMBRANCE_REGISTRY_ADDRESS must be a valid address when CHAIN_ENABLED=true",
      );
    }
    if (!this.privateKey || !isHex(this.privateKey)) {
      throw new ChainConfigError(
        "CHAIN_PRIVATE_KEY must be set when CHAIN_ENABLED=true",
      );
    }
  }

  private getPublicClient(): PublicClient {
    this.assertReady();
    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        chain: sepolia,
        transport: http(this.rpcUrl),
      });
    }
    return this.publicClient;
  }

  private getWalletClient(): WalletClient {
    this.assertReady();
    if (!this.walletClient) {
      const account = privateKeyToAccount(this.privateKey as Hex);
      this.registrarAddress = account.address;
      this.walletClient = createWalletClient({
        account,
        chain: sepolia,
        transport: http(this.rpcUrl),
      });
    }
    return this.walletClient;
  }

  private normalizeFingerprint(fingerprint: string): Hex {
    const normalized = fingerprint.toLowerCase();
    if (!isHex(normalized) || normalized.length !== 66) {
      throw new ChainWriteError(
        `Invalid fingerprint for on-chain write: ${fingerprint}`,
      );
    }
    return normalized as Hex;
  }

  private explorerTxUrl(txHash: string): string {
    return `https://sepolia.etherscan.io/tx/${txHash}`;
  }

  async isEncumbered(fingerprint: string): Promise<boolean> {
    if (!this.isEnabled) return false;
    this.assertReady();
    const client = this.getPublicClient();
    const fp = this.normalizeFingerprint(fingerprint);
    return client.readContract({
      address: this.registryAddress as Address,
      abi: encumbranceRegistryAbi,
      functionName: "isEncumbered",
      args: [fp],
    });
  }

  async getLien(fingerprint: string): Promise<OnChainLienView> {
    this.assertReady();
    const client = this.getPublicClient();
    const fp = this.normalizeFingerprint(fingerprint);
    const [lender, registeredAt, active] = await client.readContract({
      address: this.registryAddress as Address,
      abi: encumbranceRegistryAbi,
      functionName: "getLien",
      args: [fp],
    });

    return {
      fingerprint: fp,
      active,
      lender: active ? lender : null,
      registeredAt: active ? Number(registeredAt) : null,
      registryAddress: this.registryAddress as Address,
      chainId: this.chainId,
    };
  }

  async registerLien(
    fingerprint: string,
    lenderWallet: string,
  ): Promise<OnChainLienProof> {
    this.assertReady();

    if (!isAddress(lenderWallet)) {
      throw new ChainWriteError(
        `Lender wallet is not a valid address: ${lenderWallet}`,
      );
    }

    const fp = this.normalizeFingerprint(fingerprint);
    const lender = lenderWallet as Address;
    const publicClient = this.getPublicClient();
    const walletClient = this.getWalletClient();
    const registry = this.registryAddress as Address;

    const already = await publicClient.readContract({
      address: registry,
      abi: encumbranceRegistryAbi,
      functionName: "isEncumbered",
      args: [fp],
    });

    if (already) {
      const existingLender = await publicClient.readContract({
        address: registry,
        abi: encumbranceRegistryAbi,
        functionName: "getLender",
        args: [fp],
      });
      throw new ChainAlreadyEncumberedError(fp, existingLender);
    }

    const account = walletClient.account;
    if (!account) {
      throw new ChainConfigError("Wallet client has no account");
    }

    try {
      const { request } = await publicClient.simulateContract({
        address: registry,
        abi: encumbranceRegistryAbi,
        functionName: "registerLien",
        args: [fp, lender],
        account,
      });

      const txHash = await walletClient.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      if (receipt.status !== "success") {
        throw new ChainWriteError(
          `On-chain registerLien reverted (tx ${txHash})`,
          receipt,
        );
      }

      this.logger.log(
        `Registered on-chain lien fingerprint=${fp} lender=${lender} tx=${txHash}`,
      );

      return {
        fingerprint: fp,
        lender,
        registrar: account.address,
        txHash,
        chainId: this.chainId,
        registryAddress: registry,
        explorerUrl: this.explorerTxUrl(txHash),
      };
    } catch (error) {
      if (
        error instanceof ChainAlreadyEncumberedError ||
        error instanceof ChainConfigError ||
        error instanceof ChainWriteError
      ) {
        throw error;
      }

      const message =
        error instanceof Error ? error.message : "On-chain registerLien failed";

      if (/AlreadyEncumbered/i.test(message)) {
        const existingLender = await publicClient
          .readContract({
            address: registry,
            abi: encumbranceRegistryAbi,
            functionName: "getLender",
            args: [fp],
          })
          .catch(() => "0x0000000000000000000000000000000000000000" as Address);
        throw new ChainAlreadyEncumberedError(fp, existingLender);
      }

      throw new ChainWriteError(message, error);
    }
  }
}
