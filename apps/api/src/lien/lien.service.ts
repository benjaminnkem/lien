import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createPublicClient,
  createWalletClient,
  http,
  isAddress,
  isHex,
  keccak256,
  stringToHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { hardhat, sepolia } from 'viem/chains';
import {
  evidenceRootFromBytes,
  eip712Domain,
  OBLIGATION_EIP712_TYPES,
  lienStateLabel,
  signableTerms,
  buildClaimGraph,
  auditEventsToCsv,
  applyPrivacyFilter,
  defaultAttestationAdapters,
  runAttestationSuite,
  assetClassLabel,
  isAssetClass,
  type ObligationTerms,
  type PrivacyLevel,
  type AssetClass,
} from 'lien-sdk';
import {
  crossChainMockAbi,
  demoFinanceAbi,
  lienGuardAbi,
  obligationRegistryAbi,
  priorityClaimBookAbi,
  settlementTokenAbi,
} from './lien.abis';
import { LienAuditService } from './lien-audit.service';
import { LienComplianceService } from './lien-compliance.service';

/** Hardhat #1 / #2 / #3 — local demo only (never use on mainnet). */
const HARDHAT_DEMO = {
  supplierKey:
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as Hex,
  obligorKey:
    '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as Hex,
  borrowerKey:
    '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6' as Hex,
};

export const DEMO_DOC_A =
  'INVOICE INV-ACME-100\nAcme Ltd → Atlas Corp\nFace: USD 100,000\nPO: PO-9001\nDue: +90d\nRendered: PDF v1 clean layout';
export const DEMO_DOC_B =
  'INVOICE INV-ACME-100\nAcme Ltd → Atlas Corp\nFace: USD 100,000\nPO: PO-9001\nDue: +90d\nRendered: PDF v2 — different margins, filename, and metadata (same economic claim)';

export type RegisterObligationInput = {
  supplier: string;
  obligor: string;
  currency: string;
  faceValue: string;
  dueDate: number;
  invoiceReference: string;
  purchaseOrderReference?: string;
  evidenceContent: string;
  evidenceContentB?: string;
  jurisdiction?: string;
  supplierWallet: string;
  obligorSignature: Hex;
  /** When set, must match the nonce inside the obligor EIP-712 signature. */
  nonce?: Hex;
  chain?: string;
  atokenAddress?: string;
  /**
   * Optional supplier private key for local demo registration.
   * ObligationRegistry.register requires msg.sender == supplier.
   */
  supplierPrivateKey?: Hex;
};

@Injectable()
export class LienService {
  private readonly logger = new Logger(LienService.name);
  private publicClient: PublicClient | null = null;
  private walletClient: WalletClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly compliance: LienComplianceService,
    private readonly audit: LienAuditService,
  ) {}

  getStatus() {
    return {
      enabled: this.isEnabled,
      ready: this.isReady,
      /** Server-side txs (seed / operator repay). Live wallet flow does not need this. */
      operatorKeyConfigured: this.hasOperatorKey,
      chainId: this.chainId,
      trustMode: this.compliance.trustMode,
      settlementRail: this.compliance.settlementRail,
      registry: this.registryAddress || null,
      guard: this.guardAddress || null,
      protocolA: this.protocolAAddress || null,
      protocolB: this.protocolBAddress || null,
      settlementToken: this.tokenAddress || null,
      priorityBook: this.priorityBookAddress || null,
      crossChainMock: this.crossChainMockAddress || null,
      p2: {
        subordinateClaims: Boolean(this.priorityBookAddress),
        crossChainMock: Boolean(this.crossChainMockAddress),
        attestationAdapters: defaultAttestationAdapters.map((a) => ({
          name: a.name,
          kind: a.kind,
        })),
      },
    };
  }

  get isEnabled(): boolean {
    return (this.config.get<string>('lien.enabled') ?? 'true') !== 'false';
  }

  /**
   * Read path: RPC + core contract addresses.
   * Live participant flow uses browser wallets; LIEN_PRIVATE_KEY is optional.
   */
  get isReady(): boolean {
    return (
      this.isEnabled &&
      Boolean(this.rpcUrl) &&
      Boolean(this.registryAddress) &&
      Boolean(this.guardAddress)
    );
  }

  get hasOperatorKey(): boolean {
    return Boolean(this.privateKey);
  }

  private get rpcUrl(): string {
    return (
      this.config.get<string>('lien.rpcUrl') ||
      this.config.get<string>('chain.rpcUrl') ||
      ''
    );
  }

  private get chainId(): number {
    return (
      this.config.get<number>('lien.chainId') ||
      this.config.get<number>('chain.chainId') ||
      31337
    );
  }

  private get privateKey(): Hex | '' {
    const raw =
      this.config.get<string>('lien.privateKey') ||
      this.config.get<string>('chain.privateKey') ||
      '';
    if (!raw) return '';
    return (raw.startsWith('0x') ? raw : `0x${raw}`) as Hex;
  }

  private get registryAddress(): Address | '' {
    return (this.config.get<string>('lien.registryAddress') ?? '') as
      | Address
      | '';
  }

  private get guardAddress(): Address | '' {
    return (this.config.get<string>('lien.guardAddress') ?? '') as Address | '';
  }

  private get protocolAAddress(): Address | '' {
    return (this.config.get<string>('lien.protocolAAddress') ?? '') as
      | Address
      | '';
  }

  private get protocolBAddress(): Address | '' {
    return (this.config.get<string>('lien.protocolBAddress') ?? '') as
      | Address
      | '';
  }

  private get tokenAddress(): Address | '' {
    return (this.config.get<string>('lien.tokenAddress') ?? '') as Address | '';
  }

  private get priorityBookAddress(): Address | '' {
    return (this.config.get<string>('lien.priorityBookAddress') ?? '') as
      | Address
      | '';
  }

  private get crossChainMockAddress(): Address | '' {
    return (this.config.get<string>('lien.crossChainMockAddress') ?? '') as
      | Address
      | '';
  }

  private assertReady() {
    if (!this.isReady) {
      const missing: string[] = [];
      if (!this.rpcUrl) missing.push('LIEN_RPC_URL');
      if (!this.registryAddress) missing.push('LIEN_REGISTRY_ADDRESS');
      if (!this.guardAddress) missing.push('LIEN_GUARD_ADDRESS');
      throw new ServiceUnavailableException({
        message: `LienGuard stack not configured for reads. Missing: ${missing.join(', ') || 'unknown'}. Set LIEN_RPC_URL and contract addresses.`,
        code: 'LIEN_NOT_CONFIGURED',
        status: this.getStatus(),
      });
    }
  }

  /** Server-signed txs only (Hardhat seed, operator helpers). */
  private assertOperatorReady() {
    this.assertReady();
    if (!this.hasOperatorKey) {
      throw new ServiceUnavailableException({
        message:
          'Server operator key not configured. Set LIEN_PRIVATE_KEY only for server-side seed/operator txs. Live wallet demos do not need it.',
        code: 'LIEN_OPERATOR_KEY_MISSING',
        status: this.getStatus(),
      });
    }
  }

  private chainConfig() {
    return this.chainId === 11155111 ? sepolia : hardhat;
  }

  private getPublic(): PublicClient {
    this.assertReady();
    if (!this.publicClient) {
      this.publicClient = createPublicClient({
        chain: this.chainConfig(),
        transport: http(this.rpcUrl),
      });
    }
    return this.publicClient;
  }

  private getWallet(): WalletClient {
    this.assertOperatorReady();
    if (!this.walletClient) {
      const account = privateKeyToAccount(this.privateKey as Hex);
      this.walletClient = createWalletClient({
        account,
        chain: this.chainConfig(),
        transport: http(this.rpcUrl),
      });
    }
    return this.walletClient;
  }

  buildTerms(input: {
    supplier: string;
    obligor: string;
    currency: string;
    faceValue: string;
    dueDate: number;
    invoiceReference: string;
    purchaseOrderReference?: string;
    evidenceContent: string;
    jurisdiction?: string;
    nonce: Hex;
  }): ObligationTerms {
    if (!isAddress(input.supplier) || !isAddress(input.obligor)) {
      throw new BadRequestException('Invalid supplier/obligor address');
    }
    return {
      supplier: input.supplier as Address,
      obligor: input.obligor as Address,
      currency: input.currency.toUpperCase(),
      faceValue: BigInt(input.faceValue),
      dueDate: input.dueDate,
      invoiceReference: input.invoiceReference,
      purchaseOrderReference: input.purchaseOrderReference ?? '',
      evidenceRoot: evidenceRootFromBytes(input.evidenceContent),
      jurisdiction: input.jurisdiction ?? 'SG',
      version: 1n,
      nonce: input.nonce,
    };
  }

  /** viem ABI expects uint64 dueDate as bigint. */
  private toChainTerms(terms: ObligationTerms) {
    return {
      ...terms,
      dueDate: BigInt(terms.dueDate),
    };
  }

  async previewIds(input: {
    supplier: string;
    obligor: string;
    currency: string;
    faceValue: string;
    dueDate: number;
    invoiceReference: string;
    purchaseOrderReference?: string;
    evidenceContentA: string;
    evidenceContentB: string;
    jurisdiction?: string;
    nonce: string;
  }) {
    this.assertReady();
    const nonce = (
      isHex(input.nonce) ? input.nonce : evidenceRootFromBytes(input.nonce)
    ) as Hex;
    const termsA = this.buildTerms({
      ...input,
      evidenceContent: input.evidenceContentA,
      nonce,
    });
    const termsB = this.buildTerms({
      ...input,
      evidenceContent: input.evidenceContentB,
      nonce,
    });
    const publicClient = this.getPublic();
    const idA = await publicClient.readContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'obligationId',
      args: [this.toChainTerms(termsA)],
    });
    const idB = await publicClient.readContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'obligationId',
      args: [this.toChainTerms(termsB)],
    });
    return {
      evidenceHashA: termsA.evidenceRoot,
      evidenceHashB: termsB.evidenceRoot,
      obligationIdA: idA,
      obligationIdB: idB,
      sameObligationId: idA === idB,
      differentEvidence:
        termsA.evidenceRoot.toLowerCase() !== termsB.evidenceRoot.toLowerCase(),
    };
  }

  private serializeObligation(o: {
    obligationId: Hex;
    supplier: Address;
    obligor: Address;
    currency: string;
    faceValue: bigint;
    dueDate: bigint | number;
    invoiceReference: string;
    purchaseOrderReference: string;
    evidenceRoot: Hex;
    jurisdiction: string;
    version: bigint;
    nonce: Hex;
    confirmed: boolean;
    cancelled: boolean;
    registeredAt: bigint | number;
    confirmedAt: bigint | number;
  }) {
    return {
      obligationId: o.obligationId,
      supplier: o.supplier,
      obligor: o.obligor,
      currency: o.currency,
      faceValue: o.faceValue.toString(),
      dueDate: Number(o.dueDate),
      invoiceReference: o.invoiceReference,
      purchaseOrderReference: o.purchaseOrderReference,
      evidenceRoot: o.evidenceRoot,
      jurisdiction: o.jurisdiction,
      version: o.version.toString(),
      nonce: o.nonce,
      confirmed: o.confirmed,
      cancelled: o.cancelled,
      registeredAt: Number(o.registeredAt),
      confirmedAt: Number(o.confirmedAt),
    };
  }

  async getObligation(obligationId: Hex) {
    this.assertReady();
    const publicClient = this.getPublic();
    const obligation = await publicClient.readContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'getObligation',
      args: [obligationId],
    });
    const status = await publicClient.readContract({
      address: this.guardAddress as Address,
      abi: lienGuardAbi,
      functionName: 'status',
      args: [obligationId],
    });
    return {
      obligation: this.serializeObligation(obligation),
      status: {
        state: Number(status.state),
        stateLabel: lienStateLabel(Number(status.state)),
        claimController: status.claimController,
        securedAmount: status.securedAmount.toString(),
        reservedUntil: Number(status.reservedUntil),
        activeReservationId: status.activeReservationId,
        financingRef: status.financingRef,
        repaymentRef: status.repaymentRef,
      },
    };
  }

  async registerAndConfirm(input: RegisterObligationInput) {
    this.assertReady();

    const gates = await this.compliance.gateMany([
      { address: input.supplierWallet, role: 'supplier' },
      { address: input.obligor, role: 'obligor' },
    ]);
    this.compliance.assertAllEligible(gates, 'register');
    const identityChecksHash = this.compliance.aggregateIdentityHash(gates);

    const nonce = (
      input.nonce && isHex(input.nonce)
        ? input.nonce
        : evidenceRootFromBytes(
            `${input.invoiceReference}:${input.supplier}:${Date.now()}`,
          )
    ) as Hex;
    const terms = this.buildTerms({
      supplier: input.supplier,
      obligor: input.obligor,
      currency: input.currency,
      faceValue: input.faceValue,
      dueDate: input.dueDate,
      invoiceReference: input.invoiceReference,
      purchaseOrderReference: input.purchaseOrderReference,
      evidenceContent: input.evidenceContent,
      jurisdiction: input.jurisdiction,
      nonce,
    });

    const publicClient = this.getPublic();
    // register() requires msg.sender == supplier. Prefer explicit key (local demo).
    const supplierKey =
      input.supplierPrivateKey ||
      (this.chainId === 31337 &&
      input.supplier.toLowerCase() ===
        privateKeyToAccount(HARDHAT_DEMO.supplierKey).address.toLowerCase()
        ? HARDHAT_DEMO.supplierKey
        : undefined);
    const registrarAccount = supplierKey
      ? privateKeyToAccount(supplierKey)
      : this.getWallet().account!;
    const registrarWallet = createWalletClient({
      account: registrarAccount,
      chain: this.chainConfig(),
      transport: http(this.rpcUrl),
    });

    const chainTerms = this.toChainTerms(terms);

    const { request: regReq } = await publicClient.simulateContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'register',
      args: [chainTerms],
      account: registrarAccount,
    });
    const regHash = await registrarWallet.writeContract(regReq);
    await publicClient.waitForTransactionReceipt({ hash: regHash });

    // confirm may be submitted by supplier with obligor's EIP-712 signature
    const { request: confReq } = await publicClient.simulateContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'confirm',
      args: [chainTerms, input.obligorSignature],
      account: registrarAccount,
    });
    const confHash = await registrarWallet.writeContract(confReq);
    await publicClient.waitForTransactionReceipt({ hash: confHash });

    const id = await publicClient.readContract({
      address: this.registryAddress as Address,
      abi: obligationRegistryAbi,
      functionName: 'obligationId',
      args: [chainTerms],
    });

    await this.audit.record({
      obligationId: id,
      eventType: 'OBLIGATION_REGISTERED_CONFIRMED',
      outcome: 'success',
      payload: {
        registerTx: regHash,
        confirmTx: confHash,
        evidenceRoot: terms.evidenceRoot,
        identityChecksHash,
        trustMode: this.compliance.trustMode,
        gates,
      },
    });

    return {
      obligationId: id,
      registerTx: regHash,
      confirmTx: confHash,
      evidenceRoot: terms.evidenceRoot,
      evidenceRootB: input.evidenceContentB
        ? evidenceRootFromBytes(input.evidenceContentB)
        : null,
      identityChecksHash,
      trustMode: this.compliance.trustMode,
      gates,
    };
  }

  async financeWithProtocol(
    protocol: 'A' | 'B',
    input: {
      obligationId: Hex;
      borrower: string;
      amount: string;
      reservationSeconds?: number;
    },
  ) {
    this.assertReady();
    if (!isAddress(input.borrower)) {
      throw new BadRequestException('Invalid borrower');
    }
    const protocolAddress = (
      protocol === 'A' ? this.protocolAAddress : this.protocolBAddress
    ) as Address;
    if (!protocolAddress) {
      throw new ServiceUnavailableException('Protocol address missing');
    }

    // CVI + CCP gates before any value-moving call.
    const gates = await this.compliance.gateMany([
      { address: input.borrower, role: 'borrower' },
      { address: protocolAddress, role: `protocol_${protocol}` },
    ]);
    try {
      this.compliance.assertAllEligible(gates, `finance-${protocol}`);
    } catch (err) {
      await this.audit.record({
        obligationId: input.obligationId,
        eventType: 'FINANCE_BLOCKED_COMPLIANCE',
        outcome: 'blocked',
        reasonCode: 'COMPLIANCE_BLOCKED',
        payload: { protocol, gates },
      });
      throw err;
    }
    const identityChecksHash = this.compliance.aggregateIdentityHash(gates);
    const settlementRail = this.compliance.settlementRail;

    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const expiry = BigInt(
      Math.floor(Date.now() / 1000) + (input.reservationSeconds ?? 3600),
    );
    const amount = BigInt(input.amount);

    const liquidityBefore = await publicClient.readContract({
      address: protocolAddress,
      abi: demoFinanceAbi,
      functionName: 'liquidity',
    });

    try {
      const { request } = await publicClient.simulateContract({
        address: protocolAddress,
        abi: demoFinanceAbi,
        functionName: 'finance',
        args: [input.obligationId, input.borrower as Address, amount, expiry],
        account,
      });
      const txHash = await wallet.writeContract(request);
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      const status = await this.getObligation(input.obligationId);
      const clearance = await this.readClearance(
        status.status.activeReservationId as Hex,
      ).catch(() => null);
      // After activate, reservation is consumed — reconstruct clearance from status.
      const clearanceView = clearance ?? {
        obligationId: input.obligationId,
        protocol: protocolAddress,
        chainId: String(this.chainId),
        financingAmount: amount.toString(),
        reservationId: status.status.activeReservationId,
        consumed: true,
        active: false,
        identityChecksHash,
        note: 'Clearance consumed on activate (one-time)',
      };

      const liquidityAfter = await publicClient.readContract({
        address: protocolAddress,
        abi: demoFinanceAbi,
        functionName: 'liquidity',
      });

      await this.audit.record({
        obligationId: input.obligationId,
        eventType: 'FINANCE_SUCCESS',
        outcome: 'success',
        payload: {
          protocol,
          txHash,
          amount: amount.toString(),
          identityChecksHash,
          settlementRail,
          gates,
          state: status.status.stateLabel,
        },
      });

      return {
        success: true,
        protocol,
        txHash,
        status: receipt.status,
        obligation: status,
        clearance: clearanceView,
        identityChecksHash,
        settlementRail,
        gates,
        trustMode: this.compliance.trustMode,
        liquidityBefore: liquidityBefore.toString(),
        liquidityAfter: liquidityAfter.toString(),
        fundsMoved: liquidityBefore !== liquidityAfter,
      };
    } catch (error) {
      const status = await this.getObligation(input.obligationId).catch(
        () => null,
      );
      const liquidityAfter = await publicClient
        .readContract({
          address: protocolAddress,
          abi: demoFinanceAbi,
          functionName: 'liquidity',
        })
        .catch(() => null);
      const fundsMoved =
        liquidityAfter != null ? liquidityBefore !== liquidityAfter : null;
      const reasonCode =
        status?.status?.stateLabel === 'Encumbered'
          ? 'ASSET_ALREADY_ENCUMBERED'
          : status?.status?.stateLabel === 'Reserved'
            ? 'RESERVATION_CONFLICT'
            : 'FINANCE_REJECTED';

      await this.audit.record({
        obligationId: input.obligationId,
        eventType: 'FINANCE_BLOCKED',
        outcome: 'blocked',
        reasonCode,
        payload: {
          protocol,
          error: error instanceof Error ? error.message : String(error),
          fundsMoved,
          liquidityBefore: liquidityBefore.toString(),
          liquidityAfter: liquidityAfter?.toString() ?? null,
          identityChecksHash,
          settlementRail,
          gates,
        },
      });

      return {
        success: false,
        protocol,
        error: error instanceof Error ? error.message : String(error),
        reasonCode,
        message: 'BLOCKED BEFORE FUNDS MOVED',
        obligation: status,
        identityChecksHash,
        settlementRail,
        gates,
        trustMode: this.compliance.trustMode,
        liquidityBefore: liquidityBefore.toString(),
        liquidityAfter: liquidityAfter?.toString() ?? null,
        fundsMoved,
      };
    }
  }

  private async readClearance(reservationId: Hex) {
    if (
      !reservationId ||
      reservationId ===
        '0x0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      return null;
    }
    const publicClient = this.getPublic();
    const c = await publicClient.readContract({
      address: this.guardAddress as Address,
      abi: lienGuardAbi,
      functionName: 'getClearance',
      args: [reservationId],
    });
    return {
      obligationId: c.obligationId,
      protocol: c.protocol,
      chainId: c.chainId.toString(),
      financingAmount: c.financingAmount.toString(),
      reservationId: c.reservationId,
      issuedAt: Number(c.issuedAt),
      expiresAt: Number(c.expiresAt),
      nonce: c.nonce.toString(),
      active: c.active,
      consumed: c.consumed,
    };
  }

  async getAudit(obligationId?: string) {
    if (obligationId) {
      return this.audit.forObligation(obligationId);
    }
    return this.audit.recent();
  }

  async getClaimGraph(obligationId: string) {
    const events = await this.audit.forObligation(obligationId);
    return {
      obligationId,
      nodes: buildClaimGraph(
        events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          outcome: e.outcome,
          reasonCode: e.reasonCode,
          createdAt: e.createdAt,
          payload: e.payload,
        })),
      ),
      events,
    };
  }

  async exportEvidencePack(
    obligationId: Hex,
    format: 'json' | 'csv' = 'json',
    privacy: PrivacyLevel = 'public',
  ) {
    const detail = await this.getObligation(obligationId);
    const events = await this.audit.forObligation(obligationId);
    const juniors = await this.listSubordinateClaims(obligationId).catch(
      () => [],
    );
    let pack: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      trustMode: this.compliance.trustMode,
      settlementRail: this.compliance.settlementRail,
      obligation: detail.obligation,
      status: detail.status,
      subordinateClaims: juniors,
      claimGraph: buildClaimGraph(
        events.map((e) => ({
          id: e.id,
          eventType: e.eventType,
          outcome: e.outcome,
          reasonCode: e.reasonCode,
          createdAt: e.createdAt,
          payload: e.payload,
        })),
      ),
      auditTrail: events,
      disclaimer:
        'Protocol-level encumbrance evidence pack. Not a legal perfection certificate.',
    };

    if (privacy !== 'public') {
      pack = applyPrivacyFilter(pack, privacy);
    }

    if (format === 'csv') {
      return {
        format: 'csv' as const,
        filename: `lien-evidence-${obligationId.slice(0, 10)}.csv`,
        content: auditEventsToCsv(
          events.map((e) => ({
            eventType: e.eventType,
            outcome: e.outcome,
            reasonCode: e.reasonCode,
            createdAt: e.createdAt,
            payload: e.payload,
          })),
        ),
        meta: {
          obligationId,
          exportedAt: pack.exportedAt,
          privacy,
        },
      };
    }

    return { format: 'json' as const, ...pack };
  }

  /**
   * P1 demo: force CVI/CCP failure so financing never reaches settlement.
   * Does not call the finance adapter when gates fail.
   */
  async demoComplianceFailure(input: {
    obligationId: Hex;
    borrower: string;
    protocol?: 'A' | 'B';
  }) {
    this.assertReady();
    const protocol = input.protocol ?? 'B';
    const protocolAddress = (
      protocol === 'A' ? this.protocolAAddress : this.protocolBAddress
    ) as Address;

    const gates = await this.compliance.gateMany(
      [
        { address: input.borrower, role: 'borrower' },
        { address: protocolAddress, role: `protocol_${protocol}` },
      ],
      {
        forceFail: true,
        failReason: 'P1_DEMO_IDENTITY_OR_COMPLIANCE_FAILURE',
      },
    );

    try {
      this.compliance.assertAllEligible(gates, `compliance-demo-${protocol}`);
    } catch (err) {
      await this.audit.record({
        obligationId: input.obligationId,
        eventType: 'COMPLIANCE_BLOCKED',
        outcome: 'blocked',
        reasonCode: 'COMPLIANCE_BLOCKED',
        payload: {
          protocol,
          gates,
          message: 'BLOCKED BEFORE FUNDS MOVED — compliance/identity gate',
          fundsMoved: false,
        },
      });
      return {
        success: false,
        protocol,
        reasonCode: 'COMPLIANCE_BLOCKED',
        message: 'BLOCKED BEFORE FUNDS MOVED',
        detail:
          'CVI/CCP gate failed before any reservation or settlement transfer.',
        fundsMoved: false,
        gates,
        trustMode: this.compliance.trustMode,
      };
    }

    // Should be unreachable when forceFail is set.
    return { success: true, unexpected: true };
  }

  /**
   * P1 demo: create a short-lived reservation, advance Hardhat time, expire it.
   * Returns obligation to financeable Verified state.
   */
  async demoReservationExpiry(input: {
    obligationId: Hex;
    amount?: string;
    ttlSeconds?: number;
  }) {
    this.assertReady();
    if (this.chainId !== 31337) {
      throw new BadRequestException({
        message:
          'Reservation expiry demo requires local Hardhat (evm_increaseTime).',
        code: 'EXPIRY_LOCAL_ONLY',
      });
    }

    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const amount = BigInt(input.amount ?? String(80_000n * 10n ** 6n));
    const ttl = input.ttlSeconds ?? 5;
    const block = await publicClient.getBlock();
    const blockTs = Number(block.timestamp);
    const expiry = BigInt(blockTs + ttl);

    const { request: resReq } = await publicClient.simulateContract({
      address: this.guardAddress as Address,
      abi: lienGuardAbi,
      functionName: 'reserve',
      args: [input.obligationId, amount, expiry],
      account,
    });
    const reserveTx = await wallet.writeContract(resReq);
    await publicClient.waitForTransactionReceipt({ hash: reserveTx });

    const mid = await this.getObligation(input.obligationId);
    await this.audit.record({
      obligationId: input.obligationId,
      eventType: 'RESERVATION_CREATED',
      outcome: 'success',
      payload: {
        reserveTx,
        reservedUntil: mid.status.reservedUntil,
        reservationId: mid.status.activeReservationId,
        ttlSeconds: ttl,
      },
    });

    // Advance Hardhat time past expiry.
    await publicClient.request({
      method: 'evm_increaseTime' as never,
      params: [ttl + 2] as never,
    });
    await publicClient.request({
      method: 'evm_mine' as never,
      params: [] as never,
    });

    const { request: expReq } = await publicClient.simulateContract({
      address: this.guardAddress as Address,
      abi: lienGuardAbi,
      functionName: 'expireReservation',
      args: [input.obligationId],
      account,
    });
    const expireTx = await wallet.writeContract(expReq);
    await publicClient.waitForTransactionReceipt({ hash: expireTx });

    const after = await this.getObligation(input.obligationId);
    await this.audit.record({
      obligationId: input.obligationId,
      eventType: 'RESERVATION_EXPIRED',
      outcome: 'success',
      payload: {
        expireTx,
        stateAfter: after.status.stateLabel,
        note: 'Expired reservation returns obligation to financeable Verified state',
      },
    });

    return {
      success: true,
      reserveTx,
      expireTx,
      beforeState: mid.status,
      afterState: after.status,
      message:
        'Reservation expired safely — obligation is financeable again (Verified).',
    };
  }

  async repayWithProtocol(
    protocol: 'A' | 'B',
    input: {
      obligationId: Hex;
      amount: string;
      repaymentRef?: string;
    },
  ) {
    this.assertReady();
    const protocolAddress = (
      protocol === 'A' ? this.protocolAAddress : this.protocolBAddress
    ) as Address;
    if (!protocolAddress || !this.tokenAddress) {
      throw new ServiceUnavailableException('Protocol/token address missing');
    }

    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const amount = BigInt(input.amount);
    const repaymentRef = (
      input.repaymentRef && isHex(input.repaymentRef)
        ? input.repaymentRef
        : keccak256(stringToHex(`repay:${input.obligationId}:${Date.now()}`))
    ) as Hex;

    // Local demo token allows public mint; top up operator so repay is deterministic.
    const mintAbi = [
      {
        type: 'function',
        name: 'mint',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'to', type: 'address' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      },
    ] as const;
    try {
      const { request: mintReq } = await publicClient.simulateContract({
        address: this.tokenAddress as Address,
        abi: mintAbi,
        functionName: 'mint',
        args: [account.address, amount],
        account,
      });
      const mintHash = await wallet.writeContract(mintReq);
      await publicClient.waitForTransactionReceipt({ hash: mintHash });
    } catch {
      // On non-demo tokens, caller must already hold settlement balance.
    }

    const { request: approveReq } = await publicClient.simulateContract({
      address: this.tokenAddress as Address,
      abi: settlementTokenAbi,
      functionName: 'approve',
      args: [protocolAddress, amount],
      account,
    });
    const approveHash = await wallet.writeContract(approveReq);
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const { request } = await publicClient.simulateContract({
      address: protocolAddress,
      abi: demoFinanceAbi,
      functionName: 'repay',
      args: [input.obligationId, account.address, amount, repaymentRef],
      account,
    });
    const txHash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    const status = await this.getObligation(input.obligationId);
    await this.audit.record({
      obligationId: input.obligationId,
      eventType: 'CLAIM_DISCHARGED',
      outcome: 'success',
      payload: { protocol, txHash, repaymentRef, amount: amount.toString() },
    });
    return {
      success: true,
      protocol,
      txHash,
      repaymentRef,
      obligation: status,
    };
  }

  /**
   * Deterministic local/demo seed: Acme → Atlas, Document A registered + confirmed.
   * Uses Hardhat demo keys only when chainId is 31337 (never production keys).
   */
  async seedDemo() {
    this.assertReady();
    if (this.chainId !== 31337 && this.chainId !== hardhat.id) {
      throw new BadRequestException({
        message:
          'seedDemo is restricted to local Hardhat (chainId 31337). On Sepolia, register via /lien/obligations/register with a live obligor EIP-712 signature.',
        code: 'SEED_LOCAL_ONLY',
      });
    }

    const supplierAccount = privateKeyToAccount(HARDHAT_DEMO.supplierKey);
    const obligorAccount = privateKeyToAccount(HARDHAT_DEMO.obligorKey);
    const borrowerAccount = privateKeyToAccount(HARDHAT_DEMO.borrowerKey);

    const nonce = evidenceRootFromBytes(`demo-seed:${Date.now()}`);
    const dueDate = Math.floor(Date.now() / 1000) + 90 * 86400;
    const terms = this.buildTerms({
      supplier: supplierAccount.address,
      obligor: obligorAccount.address,
      currency: 'USD',
      faceValue: String(100_000n * 10n ** 6n),
      dueDate,
      invoiceReference: 'INV-ACME-100',
      purchaseOrderReference: 'PO-9001',
      evidenceContent: DEMO_DOC_A,
      jurisdiction: 'SG',
      nonce,
    });

    const domain = eip712Domain({
      chainId: this.chainId,
      verifyingContract: this.registryAddress as Address,
    });
    const obligorSignature = await obligorAccount.signTypedData({
      domain,
      types: OBLIGATION_EIP712_TYPES,
      primaryType: 'ObligationTerms',
      message: signableTerms(terms),
    });

    const registered = await this.registerAndConfirm({
      supplier: terms.supplier,
      obligor: terms.obligor,
      currency: terms.currency,
      faceValue: terms.faceValue.toString(),
      dueDate: Number(terms.dueDate),
      invoiceReference: terms.invoiceReference,
      purchaseOrderReference: terms.purchaseOrderReference,
      evidenceContent: DEMO_DOC_A,
      evidenceContentB: DEMO_DOC_B,
      jurisdiction: terms.jurisdiction,
      supplierWallet: supplierAccount.address,
      obligorSignature,
      nonce,
      chain: 'ethereum',
      supplierPrivateKey: HARDHAT_DEMO.supplierKey,
    });

    const evidenceB = evidenceRootFromBytes(DEMO_DOC_B);
    const preview = {
      evidenceHashA: registered.evidenceRoot,
      evidenceHashB: evidenceB,
      obligationId: registered.obligationId,
      differentEvidence:
        registered.evidenceRoot.toLowerCase() !== evidenceB.toLowerCase(),
      sameObligationId: true,
      note: 'Document A and Document B differ as binaries but share one Obligation ID (evidenceRoot excluded from identity).',
    };

    const status = await this.getObligation(registered.obligationId as Hex);
    const financeAmount = String(80_000n * 10n ** 6n);

    await this.audit.record({
      obligationId: registered.obligationId as string,
      eventType: 'DEMO_SEEDED',
      outcome: 'success',
      payload: {
        supplier: supplierAccount.address,
        obligor: obligorAccount.address,
        trustMode: this.compliance.trustMode,
        preview,
      },
    });

    return {
      demo: {
        supplierName: 'Acme Ltd',
        obligorName: 'Atlas Corp',
        supplier: supplierAccount.address,
        obligor: obligorAccount.address,
        borrower: borrowerAccount.address,
        invoiceReference: 'INV-ACME-100',
        purchaseOrderReference: 'PO-9001',
        faceValue: '100000000000',
        faceValueDisplay: 'USD 100,000',
        financeAmount,
        financeAmountDisplay: 'USD 80,000',
        documentA: DEMO_DOC_A,
        documentB: DEMO_DOC_B,
        dueDate,
      },
      obligationId: registered.obligationId,
      registerTx: registered.registerTx,
      confirmTx: registered.confirmTx,
      preview,
      status: status.status,
      identityChecksHash: registered.identityChecksHash,
      gates: registered.gates,
      trustMode: this.compliance.trustMode,
      settlementRail: this.compliance.settlementRail,
      next: {
        financeA: `POST /api/lien/protocols/A/finance { obligationId, borrower, amount: "${financeAmount}" }`,
        financeB: `POST /api/lien/protocols/B/finance { obligationId, borrower, amount: "${financeAmount}" }`,
        discharge: `POST /api/lien/protocols/A/repay { obligationId, amount: "${financeAmount}" }`,
      },
    };
  }

  async protocolBalances() {
    this.assertReady();
    const publicClient = this.getPublic();
    const [liqA, liqB] = await Promise.all([
      this.protocolAAddress
        ? publicClient.readContract({
            address: this.protocolAAddress as Address,
            abi: demoFinanceAbi,
            functionName: 'liquidity',
          })
        : Promise.resolve(null),
      this.protocolBAddress
        ? publicClient.readContract({
            address: this.protocolBAddress as Address,
            abi: demoFinanceAbi,
            functionName: 'liquidity',
          })
        : Promise.resolve(null),
    ]);
    return {
      protocolA: this.protocolAAddress || null,
      protocolB: this.protocolBAddress || null,
      liquidityA: liqA?.toString() ?? null,
      liquidityB: liqB?.toString() ?? null,
    };
  }

  // ─── P2: subordinate claims ───────────────────────────────────────────

  async listSubordinateClaims(obligationId: Hex) {
    if (!this.priorityBookAddress) return [];
    this.assertReady();
    const publicClient = this.getPublic();
    const claims = await publicClient.readContract({
      address: this.priorityBookAddress as Address,
      abi: priorityClaimBookAbi,
      functionName: 'getClaims',
      args: [obligationId],
    });
    return claims.map((c) => ({
      claimId: c.claimId,
      obligationId: c.obligationId,
      protocol: c.protocol,
      priorityRank: Number(c.priorityRank),
      amount: c.amount.toString(),
      claimRef: c.claimRef,
      label: c.label,
      active: c.active,
      registeredAt: Number(c.registeredAt),
      releasedAt: Number(c.releasedAt),
      disclaimer: 'Protocol-level priority only — not legal perfection',
    }));
  }

  async registerSubordinateClaim(input: {
    obligationId: Hex;
    priorityRank: number;
    amount: string;
    label?: string;
    claimRef?: string;
  }) {
    this.assertReady();
    if (!this.priorityBookAddress) {
      throw new ServiceUnavailableException('PriorityClaimBook not configured');
    }
    if (input.priorityRank < 1 || input.priorityRank > 255) {
      throw new BadRequestException(
        'priorityRank must be 1–255 (0 is exclusive/senior on LienGuard)',
      );
    }
    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const claimRef = (
      input.claimRef && isHex(input.claimRef)
        ? input.claimRef
        : keccak256(stringToHex(`sub:${input.obligationId}:${Date.now()}`))
    ) as Hex;
    const label = input.label ?? `junior-rank-${input.priorityRank}`;
    const amount = BigInt(input.amount);

    const { request, result: claimId } = await publicClient.simulateContract({
      address: this.priorityBookAddress as Address,
      abi: priorityClaimBookAbi,
      functionName: 'registerSubordinate',
      args: [input.obligationId, input.priorityRank, amount, claimRef, label],
      account,
    });
    const txHash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    const claims = await this.listSubordinateClaims(input.obligationId);
    await this.audit.record({
      obligationId: input.obligationId,
      eventType: 'SUBORDINATE_CLAIM_REGISTERED',
      outcome: 'success',
      payload: {
        txHash,
        claimId,
        priorityRank: input.priorityRank,
        amount: amount.toString(),
        label,
        disclaimer: 'Protocol-level priority only',
      },
    });
    return {
      success: true,
      txHash,
      claimId,
      claims,
      disclaimer:
        'Subordinate claims are protocol-level disclosures only — not legally perfected liens.',
    };
  }

  async releaseSubordinateClaim(claimId: Hex, obligationId: Hex) {
    this.assertReady();
    if (!this.priorityBookAddress) {
      throw new ServiceUnavailableException('PriorityClaimBook not configured');
    }
    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const { request } = await publicClient.simulateContract({
      address: this.priorityBookAddress as Address,
      abi: priorityClaimBookAbi,
      functionName: 'releaseSubordinate',
      args: [claimId],
      account,
    });
    const txHash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    await this.audit.record({
      obligationId,
      eventType: 'SUBORDINATE_CLAIM_RELEASED',
      outcome: 'success',
      payload: { txHash, claimId },
    });
    return { success: true, txHash };
  }

  // ─── P2: cross-chain mock ─────────────────────────────────────────────

  async postCrossChainClearance(input: {
    obligationId: Hex;
    targetChainId: number;
    clearanceHash?: string;
  }) {
    this.assertReady();
    if (!this.crossChainMockAddress) {
      throw new ServiceUnavailableException(
        'CrossChainClearanceMock not configured',
      );
    }
    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const clearanceHash = (
      input.clearanceHash && isHex(input.clearanceHash)
        ? input.clearanceHash
        : keccak256(
            stringToHex(
              `xchain:${input.obligationId}:${input.targetChainId}:${Date.now()}`,
            ),
          )
    ) as Hex;

    const { request, result: recordId } = await publicClient.simulateContract({
      address: this.crossChainMockAddress as Address,
      abi: crossChainMockAbi,
      functionName: 'postClearance',
      args: [input.obligationId, BigInt(input.targetChainId), clearanceHash],
      account,
    });
    const txHash = await wallet.writeContract(request);
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    await this.audit.record({
      obligationId: input.obligationId,
      eventType: 'CROSS_CHAIN_CLEARANCE_POSTED',
      outcome: 'success',
      payload: {
        txHash,
        recordId,
        sourceChainId: this.chainId,
        targetChainId: input.targetChainId,
        clearanceHash,
        note: 'Architecture mock — not a production bridge; no assets moved cross-chain',
        blockNumber: receipt.blockNumber.toString(),
      },
    });

    return {
      success: true,
      txHash,
      recordId,
      sourceChainId: this.chainId,
      targetChainId: input.targetChainId,
      clearanceHash,
      disclaimer:
        'Cross-chain architecture demonstration only. No bridge, no remote settlement.',
    };
  }

  async consumeCrossChainClearance(input: {
    recordId: Hex;
    obligationId?: Hex;
  }) {
    this.assertReady();
    if (!this.crossChainMockAddress) {
      throw new ServiceUnavailableException(
        'CrossChainClearanceMock not configured',
      );
    }
    const wallet = this.getWallet();
    const publicClient = this.getPublic();
    const account = wallet.account!;
    const { request } = await publicClient.simulateContract({
      address: this.crossChainMockAddress as Address,
      abi: crossChainMockAbi,
      functionName: 'consumeClearance',
      args: [input.recordId],
      account,
    });
    const txHash = await wallet.writeContract(request);
    await publicClient.waitForTransactionReceipt({ hash: txHash });
    const rec = await publicClient.readContract({
      address: this.crossChainMockAddress as Address,
      abi: crossChainMockAbi,
      functionName: 'getRecord',
      args: [input.recordId],
    });
    await this.audit.record({
      obligationId: (input.obligationId ?? rec.obligationId) as string,
      eventType: 'CROSS_CHAIN_CLEARANCE_CONSUMED',
      outcome: 'success',
      payload: {
        txHash,
        recordId: input.recordId,
        consumed: rec.consumed,
      },
    });
    return {
      success: true,
      txHash,
      record: {
        recordId: rec.recordId,
        obligationId: rec.obligationId,
        sourceChainId: rec.sourceChainId.toString(),
        targetChainId: rec.targetChainId.toString(),
        clearanceHash: rec.clearanceHash,
        active: rec.active,
        consumed: rec.consumed,
      },
    };
  }

  // ─── P2: attestations + asset classes + analytics ─────────────────────

  buildAttestationBundle(input: {
    obligationId?: string;
    supplier?: string;
    invoiceReference?: string;
    evidenceContent?: string;
    assetClass?: string;
    gates?: Array<Record<string, unknown>>;
    crossChain?: Record<string, unknown>;
  }) {
    const assetClass: AssetClass = isAssetClass(input.assetClass ?? 'invoice')
      ? (input.assetClass as AssetClass)
      : 'invoice';

    const evidenceAdapter = defaultAttestationAdapters.find(
      (a) => a.kind === 'evidence_root',
    )!;
    const supplierAdapter = defaultAttestationAdapters.find(
      (a) => a.kind === 'supplier_statement',
    )!;
    const assetAdapter = defaultAttestationAdapters.find(
      (a) => a.kind === 'asset_class_declaration',
    )!;
    const cviAdapter = defaultAttestationAdapters.find(
      (a) => a.kind === 'cleanverse_cvi',
    )!;
    const xAdapter = defaultAttestationAdapters.find(
      (a) => a.kind === 'cross_chain_clearance',
    )!;

    const suite: Array<{
      adapter: (typeof defaultAttestationAdapters)[number];
      input: Record<string, unknown>;
    }> = [
      {
        adapter: evidenceAdapter,
        input: { content: input.evidenceContent ?? '' },
      },
      {
        adapter: supplierAdapter,
        input: {
          supplier: input.supplier ?? '',
          invoiceReference: input.invoiceReference ?? '',
        },
      },
      {
        adapter: assetAdapter,
        input: {
          assetClass,
          obligationId: input.obligationId ?? '',
        },
      },
    ];

    for (const g of input.gates ?? []) {
      suite.push({
        adapter: cviAdapter,
        input: {
          address: g.address,
          role: g.role,
          source: g.source,
          eligible: (g.cvi as { eligible?: boolean } | undefined)?.eligible,
          labeledMock: g.labeledMock,
        },
      });
    }

    if (input.crossChain) {
      suite.push({ adapter: xAdapter, input: input.crossChain });
    }

    const attestations = runAttestationSuite(suite);
    return {
      assetClass,
      assetClassLabel: assetClassLabel(assetClass),
      attestations,
      note: 'Attestation adapters produce commitments for audit; obligor EIP-712 remains authoritative on-chain.',
    };
  }

  /**
   * Live mode: prepare canonical terms + EIP-712 payload for wallet signing.
   * Does not write on-chain — user wallets execute register/confirm.
   */
  async prepareLiveObligation(input: {
    supplier: string;
    obligor: string;
    currency?: string;
    faceValue: string;
    dueDate: number;
    invoiceReference: string;
    purchaseOrderReference?: string;
    evidenceContent: string;
    evidenceContentB?: string;
    jurisdiction?: string;
    nonce?: string;
  }) {
    if (!isAddress(input.supplier) || !isAddress(input.obligor)) {
      throw new BadRequestException('Invalid supplier/obligor');
    }
    if (!this.registryAddress) {
      throw new ServiceUnavailableException('Registry not configured');
    }
    const nonce = (
      input.nonce && isHex(input.nonce)
        ? input.nonce
        : evidenceRootFromBytes(
            `${input.invoiceReference}:${input.supplier}:${Date.now()}`,
          )
    ) as Hex;
    const terms = this.buildTerms({
      supplier: input.supplier,
      obligor: input.obligor,
      currency: input.currency ?? 'USD',
      faceValue: input.faceValue,
      dueDate: input.dueDate,
      invoiceReference: input.invoiceReference,
      purchaseOrderReference: input.purchaseOrderReference,
      evidenceContent: input.evidenceContent,
      jurisdiction: input.jurisdiction,
      nonce,
    });
    const domain = eip712Domain({
      chainId: this.chainId,
      verifyingContract: this.registryAddress as Address,
    });
    const message = signableTerms(terms);
    let obligationId: Hex | null = null;
    if (this.isReady) {
      try {
        obligationId = (await this.getPublic().readContract({
          address: this.registryAddress as Address,
          abi: obligationRegistryAbi,
          functionName: 'obligationId',
          args: [this.toChainTerms(terms)],
        })) as Hex;
      } catch {
        obligationId = null;
      }
    }
    const evidenceRootB = input.evidenceContentB
      ? evidenceRootFromBytes(input.evidenceContentB)
      : null;

    const gates = await this.compliance.gateMany([
      { address: input.supplier, role: 'supplier' },
      { address: input.obligor, role: 'obligor' },
    ]);

    return {
      chainId: this.chainId,
      registry: this.registryAddress,
      trustMode: this.compliance.trustMode,
      terms: {
        supplier: terms.supplier,
        obligor: terms.obligor,
        currency: terms.currency,
        faceValue: terms.faceValue.toString(),
        dueDate: terms.dueDate,
        invoiceReference: terms.invoiceReference,
        purchaseOrderReference: terms.purchaseOrderReference,
        evidenceRoot: terms.evidenceRoot,
        jurisdiction: terms.jurisdiction,
        version: terms.version.toString(),
        nonce: terms.nonce,
      },
      evidenceRootB,
      differentEvidence: evidenceRootB
        ? terms.evidenceRoot.toLowerCase() !== evidenceRootB.toLowerCase()
        : null,
      predictedObligationId: obligationId,
      eip712: {
        domain,
        types: OBLIGATION_EIP712_TYPES,
        primaryType: 'ObligationTerms',
        message: {
          ...message,
          faceValue: message.faceValue.toString(),
          dueDate: message.dueDate.toString(),
          version: message.version.toString(),
        },
      },
      gates,
      identityChecksHash: this.compliance.aggregateIdentityHash(gates),
      nextSteps: [
        '1. Supplier wallet calls ObligationRegistry.register(terms)',
        '2. Obligor wallet signs EIP-712 ObligationTerms (evidenceRoot excluded from type)',
        '3. Supplier or obligor calls ObligationRegistry.confirm(terms, signature)',
        '4. Any wallet calls DemoFinanceA.finance / DemoFinanceB.finance',
      ],
    };
  }

  async checkParticipantGate(address: string, role = 'participant') {
    if (!isAddress(address)) {
      throw new BadRequestException('Invalid address');
    }
    const gate = await this.compliance.gateParticipant(address, role);
    return {
      trustMode: this.compliance.trustMode,
      gate,
      eligible: gate.cvi.eligible && gate.ccp.allowed,
    };
  }

  async recordClientAudit(input: {
    obligationId?: string;
    eventType: string;
    outcome: string;
    reasonCode?: string;
    payload?: Record<string, unknown>;
  }) {
    return this.audit.record({
      obligationId: input.obligationId ?? null,
      eventType: input.eventType,
      outcome: input.outcome,
      reasonCode: input.reasonCode ?? null,
      payload: {
        ...(input.payload ?? {}),
        source: 'client-wallet',
      },
    });
  }

  async getAnalytics() {
    const recent = await this.audit.recent(500);
    const byType: Record<string, number> = {};
    const byOutcome: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    for (const e of recent) {
      byType[e.eventType] = (byType[e.eventType] ?? 0) + 1;
      byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
      if (e.reasonCode) {
        byReason[e.reasonCode] = (byReason[e.reasonCode] ?? 0) + 1;
      }
    }
    return {
      window: 'last_500_audit_events',
      totals: {
        events: recent.length,
        blocked: byOutcome.blocked ?? 0,
        success: byOutcome.success ?? 0,
      },
      byType,
      byOutcome,
      byReason,
      stack: this.getStatus(),
    };
  }
}
