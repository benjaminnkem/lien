import {
  BadGatewayException,
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { isAddress, isHex, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  createAssetFingerprint,
  formatNetworkLabel,
  isCrossChainAttempt,
  isVerifyApassAllowed,
  mapVerifyApassMessage,
  normalizeSettlementNetwork,
  type AssetStatus,
  type InvoiceFields,
} from 'lien-sdk';
import { AssetEntity } from './entities/asset.entity';
import { LienEntity } from './entities/lien.entity';
import { AuditEventEntity } from './entities/audit-event.entity';
import { CreateFingerprintDto } from './dto/create-fingerprint.dto';
import { CheckEncumbranceDto } from './dto/check-encumbrance.dto';
import { FinanceAssetDto } from './dto/finance-asset.dto';
import { IssueCvaDto } from './dto/issue-cva.dto';
import { CleanverseService } from '../cleanverse/cleanverse.service';
import {
  CleanverseApiError,
  CleanverseConfigError,
} from '../cleanverse/cleanverse.errors';
import { ChainService, type OnChainLienProof } from '../chain/chain.service';
import {
  ChainAlreadyEncumberedError,
  ChainConfigError,
  ChainWriteError,
} from '../chain/chain.errors';
import type { PartyVerificationEvidence } from './party-verification.types';

type VerificationRole = PartyVerificationEvidence['role'];

type PartyVerificationInput = {
  role: VerificationRole;
  fingerprint: string;
  assetId: string | null;
  wallet?: string | null;
  chain?: string | null;
  atokenAddress?: string | null;
};

const verifyFailureCodes: Record<number, string> = {
  1: 'CVI_ATOKEN_NOT_FOUND',
  2: 'CVI_NO_APASS',
  3: 'CVI_TRANSFER_BLOCKED',
};

@Injectable()
export class AssetsService {
  private lastAuditTimestamp = 0;

  constructor(
    @InjectRepository(AssetEntity)
    private readonly assets: Repository<AssetEntity>,
    @InjectRepository(LienEntity)
    private readonly liens: Repository<LienEntity>,
    @InjectRepository(AuditEventEntity)
    private readonly audits: Repository<AuditEventEntity>,
    private readonly cleanverse: CleanverseService,
    private readonly chain: ChainService,
    private readonly config: ConfigService,
  ) {}

  async createFingerprint(dto: CreateFingerprintDto) {
    const fields = this.toInvoiceFields(dto);
    const fingerprint = createAssetFingerprint(fields);

    let asset = await this.assets.findOne({ where: { fingerprint } });
    const isNew = !asset;
    const issuerVerification = await this.verifyParty({
      role: 'issuer',
      fingerprint,
      assetId: asset?.id ?? null,
      wallet: dto.issuerWallet,
      chain: dto.chain,
      atokenAddress: dto.atokenAddress,
    });

    if (!asset) {
      asset = this.assets.create({
        fingerprint,
        issuerCvi: fields.issuerCvi,
        debtorCvi: fields.debtorCvi,
        documentHash: fields.documentHash,
        invoiceNumber: fields.invoiceNumber,
        amount: fields.amount,
        currency: fields.currency,
        dueDate: fields.dueDate,
        status: 'fingerprinted',
        chain: dto.chain,
        issuerWallet: dto.issuerWallet,
        debtorWallet: dto.debtorWallet ?? null,
        atokenAddress: dto.atokenAddress,
        issuerVerification,
        issuerCviVerifiedAt: new Date(issuerVerification.verifiedAt),
      });
    } else {
      asset.chain = dto.chain;
      asset.issuerWallet = dto.issuerWallet;
      asset.atokenAddress = dto.atokenAddress;
      asset.issuerVerification = issuerVerification;
      asset.issuerCviVerifiedAt = new Date(issuerVerification.verifiedAt);
      if (dto.debtorWallet) asset.debtorWallet = dto.debtorWallet;
    }

    const activeLien = await this.findActiveLien(fingerprint);
    if (activeLien) {
      asset.status = 'financed';
    } else if (
      asset.status !== 'minting' &&
      asset.status !== 'minted' &&
      asset.status !== 'financed'
    ) {
      asset.status = 'clean';
    }
    asset = await this.assets.save(asset);

    if (isNew) {
      await this.audit('FINGERPRINT_CREATED', fingerprint, asset.id, {
        invoiceNumber: fields.invoiceNumber,
        amount: fields.amount,
        currency: fields.currency,
      });
    }

    return {
      id: asset.id,
      fingerprint: asset.fingerprint,
      status: asset.status,
      fields: this.assetFields(asset),
      isClean: !activeLien,
      existingLienId: activeLien?.id ?? null,
      issuerVerification,
      cva: this.serializeCva(asset),
      createdAt: asset.createdAt,
    };
  }

  async check(dto: CheckEncumbranceDto) {
    const fingerprint = this.resolveFingerprint(dto);
    const asset = await this.assets.findOne({ where: { fingerprint } });
    const activeLien = await this.findActiveLien(fingerprint);

    const isClean = !activeLien;
    const status: AssetStatus = activeLien
      ? 'encumbered'
      : asset?.status === 'financed'
        ? 'financed'
        : asset?.status === 'minted'
          ? 'minted'
          : asset?.status === 'minting'
            ? 'minting'
            : asset
              ? 'clean'
              : 'draft';

    const settlementChain = this.resolveSettlementChain(activeLien, asset);
    const result = {
      fingerprint,
      isClean,
      status,
      existingLienId: activeLien?.id ?? null,
      settlementChain,
      scope: 'global' as const,
      reason: activeLien
        ? `Fingerprint already encumbered globally by first-priority lien ${activeLien.id} on ${formatNetworkLabel(settlementChain)} (lender ${activeLien.lenderCvi}). Re-pledge on any network is blocked.`
        : asset
          ? 'No active lien — fingerprint is clean for financing on any settlement network'
          : 'Fingerprint not registered yet; no active lien found',
      asset: asset
        ? {
            id: asset.id,
            status: asset.status,
            invoiceNumber: asset.invoiceNumber,
            chain: asset.chain,
          }
        : null,
      lien: activeLien
        ? {
            id: activeLien.id,
            lenderCvi: activeLien.lenderCvi,
            priority: activeLien.priority,
            registeredAt: activeLien.registeredAt,
            settlementChain,
            txHash: activeLien.txHash,
          }
        : null,
    };

    await this.audit('ENCUMBRANCE_CHECKED', fingerprint, asset?.id ?? null, {
      isClean,
      status,
      existingLienId: activeLien?.id ?? null,
      settlementChain,
      scope: 'global',
    });

    return result;
  }

  async finance(dto: FinanceAssetDto) {
    if (!dto.fingerprint && !dto.fields) {
      throw new BadRequestException(
        'Provide fingerprint or invoice fields to finance an asset',
      );
    }

    let asset: AssetEntity | null = null;
    let fingerprint: string;

    if (dto.fingerprint) {
      fingerprint = dto.fingerprint.toLowerCase();
      asset = await this.assets.findOne({ where: { fingerprint } });
      if (!asset) {
        throw new NotFoundException(
          `No asset registered for fingerprint ${fingerprint}. Create a fingerprint first.`,
        );
      }
    } else {
      throw new BadRequestException({
        message:
          'Fingerprint the invoice through the issuer verification gate before financing',
        code: 'FINGERPRINT_REQUIRED',
      });
    }

    if (asset.status === 'minting') {
      throw new BadRequestException({
        message:
          'CVA issuance is still pending. Poll CVA status until the asset is minted.',
        code: 'CVA_PENDING',
        fingerprint,
        cva: this.serializeCva(asset),
      });
    }

    if (asset.status !== 'minted' && asset.status !== 'financed') {
      throw new BadRequestException({
        message:
          'Issue this receivable as a Cleanverse CVA before financing. Registry must be clean, then mint.',
        code: 'CVA_REQUIRED',
        fingerprint,
        status: asset.status,
      });
    }

    const attemptedChain =
      normalizeSettlementNetwork(dto.chain ?? asset.chain) ?? 'ethereum';
    const atokenAddress =
      asset.cvaAtokenAddress ??
      dto.atokenAddress ??
      asset.atokenAddress;

    const existingEarly = await this.findActiveLien(fingerprint);
    if (existingEarly) {
      let lenderVerification: PartyVerificationEvidence | null = null;
      try {
        lenderVerification = await this.verifyParty({
          role: 'lender',
          fingerprint,
          assetId: asset.id,
          wallet: dto.lenderWallet,
          chain: attemptedChain,
          atokenAddress,
        });
      } catch {
        lenderVerification = null;
      }
      throw await this.rejectDuplicateFinance({
        fingerprint,
        asset,
        existing: existingEarly,
        attemptedChain,
        attemptedLenderCvi: dto.lenderCvi,
        attemptedLenderWallet: dto.lenderWallet,
        lenderVerification,
        source: 'registry',
        reason: 'duplicate_financing',
      });
    }

    const lenderVerification = await this.verifyParty({
      role: 'lender',
      fingerprint,
      assetId: asset.id,
      wallet: dto.lenderWallet,
      chain: attemptedChain,
      atokenAddress,
    });

    if (this.chain.isEnabled) {
      try {
        const onChainEncumbered = await this.chain.isEncumbered(fingerprint);
        if (onChainEncumbered) {
          const onChain = await this.chain.getLien(fingerprint);
          throw await this.rejectDuplicateFinance({
            fingerprint,
            asset,
            existing: null,
            attemptedChain,
            attemptedLenderCvi: dto.lenderCvi,
            attemptedLenderWallet: dto.lenderWallet,
            lenderVerification,
            source: 'on_chain',
            reason: 'on_chain_duplicate_financing',
            onChainLender: onChain.lender,
            onChainRegisteredAt: onChain.registeredAt,
            registryAddress: onChain.registryAddress,
          });
        }
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        if (error instanceof ChainConfigError) {
          throw new ServiceUnavailableException({
            message: error.message,
            code: 'CHAIN_NOT_CONFIGURED',
          });
        }
        throw new BadGatewayException({
          message: `On-chain encumbrance check failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
          code: 'CHAIN_READ_FAILED',
        });
      }
    }

    let onChainProof: OnChainLienProof | null = null;
    if (this.chain.isEnabled) {
      if (!dto.lenderWallet) {
        throw new BadRequestException({
          message: 'lenderWallet is required for on-chain lien registration',
          code: 'LENDER_WALLET_REQUIRED',
        });
      }
      try {
        onChainProof = await this.chain.registerLien(
          fingerprint,
          dto.lenderWallet,
        );
      } catch (error) {
        if (error instanceof ChainAlreadyEncumberedError) {
          throw await this.rejectDuplicateFinance({
            fingerprint,
            asset,
            existing: null,
            attemptedChain,
            attemptedLenderCvi: dto.lenderCvi,
            attemptedLenderWallet: dto.lenderWallet,
            lenderVerification,
            source: 'on_chain',
            reason: 'on_chain_duplicate_financing',
            onChainLender: error.existingLender,
          });
        }
        if (error instanceof ChainConfigError) {
          throw new ServiceUnavailableException({
            message: error.message,
            code: 'CHAIN_NOT_CONFIGURED',
          });
        }
        const detail =
          error instanceof ChainWriteError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'unknown error';
        await this.audit('FINANCING_BLOCKED', fingerprint, asset.id, {
          attemptedLenderCvi: dto.lenderCvi,
          attemptedLenderWallet: dto.lenderWallet,
          attemptedChain,
          reason: 'on_chain_register_failed',
          detail,
        });
        throw new BadGatewayException({
          message: `On-chain lien registration failed: ${detail}`,
          code: 'CHAIN_WRITE_FAILED',
        });
      }
    }

    const lien = this.liens.create({
      fingerprint,
      assetId: asset.id,
      lenderCvi: dto.lenderCvi,
      lenderWallet: dto.lenderWallet,
      lenderVerification,
      lenderCviVerifiedAt: new Date(lenderVerification.verifiedAt),
      priority: 1,
      status: 'active',
      cvaId: dto.cvaId ?? asset.cvaId ?? null,
      txHash: onChainProof?.txHash ?? dto.txHash ?? null,
      settlementChain: attemptedChain,
    });

    const savedLien = await this.liens.save(lien);

    asset.status = 'financed';
    asset.chain = attemptedChain;
    asset.atokenAddress = atokenAddress;
    if (dto.cvaId) asset.cvaId = dto.cvaId;
    await this.assets.save(asset);

    await this.audit('LIEN_REGISTERED', fingerprint, asset.id, {
      lienId: savedLien.id,
      lenderCvi: savedLien.lenderCvi,
      priority: savedLien.priority,
      cvaId: savedLien.cvaId,
      txHash: savedLien.txHash,
      settlementChain: savedLien.settlementChain,
      scope: 'global',
      onChain: onChainProof
        ? {
            registryAddress: onChainProof.registryAddress,
            registrar: onChainProof.registrar,
            chainId: onChainProof.chainId,
            explorerUrl: onChainProof.explorerUrl,
          }
        : null,
    });

    return {
      success: true,
      fingerprint,
      scope: 'global',
      asset: {
        id: asset.id,
        status: asset.status,
        invoiceNumber: asset.invoiceNumber,
        amount: asset.amount,
        currency: asset.currency,
        chain: asset.chain,
      },
      lien: {
        id: savedLien.id,
        lenderCvi: savedLien.lenderCvi,
        lenderWallet: savedLien.lenderWallet,
        priority: savedLien.priority,
        status: savedLien.status,
        cvaId: savedLien.cvaId,
        txHash: savedLien.txHash,
        settlementChain: savedLien.settlementChain,
        registeredAt: savedLien.registeredAt,
      },
      lenderVerification,
      cleanverse: {
        allowed: true,
        verifyApass: {
          code: lenderVerification.verifyCode,
          message: lenderVerification.verifyMessage,
        },
      },
      onChain: onChainProof
        ? {
            registered: true,
            txHash: onChainProof.txHash,
            explorerUrl: onChainProof.explorerUrl,
            registryAddress: onChainProof.registryAddress,
            registrar: onChainProof.registrar,
            chainId: onChainProof.chainId,
            lender: onChainProof.lender,
          }
        : {
            registered: false,
            reason: this.chain.isEnabled
              ? 'chain_write_skipped'
              : 'chain_disabled',
          },
    };
  }

  async issueCva(dto: IssueCvaDto) {
    const fingerprint = dto.fingerprint.toLowerCase();
    const asset = await this.assets.findOne({ where: { fingerprint } });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${fingerprint}`);
    }

    const activeLien = await this.findActiveLien(fingerprint);
    if (activeLien) {
      throw new ConflictException({
        message: 'Cannot issue CVA: fingerprint already has an active lien',
        code: 'ALREADY_ENCUMBERED',
        fingerprint,
      });
    }

    if (asset.status === 'minted' && asset.cvaAtokenAddress) {
      return {
        fingerprint,
        status: asset.status,
        cva: this.serializeCva(asset),
        alreadyIssued: true,
      };
    }

    if (asset.status === 'minting' && asset.cvaRequestId) {
      return this.refreshCvaStatus(fingerprint);
    }

    if (asset.status !== 'clean' && asset.status !== 'fingerprinted') {
      throw new BadRequestException({
        message: `Asset status ${asset.status} is not eligible for CVA issuance`,
        code: 'CVA_NOT_ELIGIBLE',
        status: asset.status,
      });
    }

    const chain = normalizeSettlementNetwork(asset.chain) ?? 'ethereum';
    const adminAddress = this.resolveCvaAdminAddress(
      dto.adminAddress ?? asset.issuerWallet,
    );
    const tokenName = `Lien Invoice ${asset.invoiceNumber}`.slice(0, 64);
    const tokenSymbol = this.buildCvaSymbol(asset);
    const icon =
      this.config.get<string>('cva.iconUrl') ??
      'https://images.cleanverse.com/app/token_icon/USDC.svg';

    asset.status = 'minting';
    asset.cvaName = tokenName;
    asset.cvaSymbol = tokenSymbol;
    asset.cvaApplyStatus = 'SUBMITTING';
    await this.assets.save(asset);

    let requestId: string;
    try {
      const launched = await this.cleanverse.launchAtoken({
        chain,
        token_name: tokenName,
        token_symbol: tokenSymbol,
        decimals: 6,
        admin_address: adminAddress,
        rule: {
          allowed_group: '',
          allowed_sub_group: '',
          min_tier: 0,
          min_sub_tier: 0,
          is_black_list: false,
          countries: [],
        },
        icon,
      });
      requestId = launched.data.requestId;
    } catch (error) {
      asset.status = 'clean';
      asset.cvaApplyStatus = 'SUBMIT_FAILED';
      await this.assets.save(asset);
      if (error instanceof CleanverseConfigError) {
        throw new ServiceUnavailableException({
          message: error.message,
          code: 'CLEANVERSE_NOT_CONFIGURED',
        });
      }
      const detail =
        error instanceof CleanverseApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Cleanverse launch failed';
      await this.audit('CVA_ISSUE_FAILED', fingerprint, asset.id, {
        detail,
        tokenSymbol,
        chain,
      });
      throw new BadGatewayException({
        message: `CVA launch failed: ${detail}`,
        code: 'CVA_LAUNCH_FAILED',
      });
    }

    asset.cvaRequestId = requestId;
    asset.cvaId = requestId;
    asset.cvaApplyStatus = 'PENDING';
    await this.assets.save(asset);

    await this.audit('CVA_ISSUE_REQUESTED', fingerprint, asset.id, {
      requestId,
      tokenName,
      tokenSymbol,
      chain,
      adminAddress,
    });

    return this.pollCvaUntilTerminal(asset);
  }

  async refreshCvaStatus(fingerprint: string) {
    const normalized = fingerprint.toLowerCase();
    const asset = await this.assets.findOne({
      where: { fingerprint: normalized },
    });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${normalized}`);
    }
    if (!asset.cvaRequestId) {
      throw new BadRequestException({
        message: 'No CVA issuance request exists for this fingerprint',
        code: 'CVA_NOT_STARTED',
      });
    }
    return this.pollCvaUntilTerminal(asset, 1);
  }

  async getByFingerprint(fingerprint: string) {
    const normalized = fingerprint.toLowerCase();
    let asset = await this.assets.findOne({
      where: { fingerprint: normalized },
    });
    if (!asset) {
      throw new NotFoundException(`Asset not found: ${normalized}`);
    }

    if (asset.status === 'minting' && asset.cvaRequestId) {
      await this.pollCvaUntilTerminal(asset, 1);
      asset = (await this.assets.findOne({
        where: { fingerprint: normalized },
      }))!;
    }

    const liens = await this.liens.find({
      where: { fingerprint: normalized },
      order: { registeredAt: 'DESC' },
    });

    return {
      ...this.serializeAsset(asset),
      liens: liens.map((l) => this.serializeLien(l)),
    };
  }

  async listAudit(fingerprint?: string, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    if (fingerprint) {
      return this.audits.find({
        where: { fingerprint: fingerprint.toLowerCase() },
        order: { createdAt: 'DESC' },
        take,
      });
    }
    return this.audits.find({
      order: { createdAt: 'DESC' },
      take,
    });
  }

  async listAssets(limit = 50) {
    const take = Math.min(Math.max(limit, 1), 200);
    const assets = await this.assets.find({
      order: { createdAt: 'DESC' },
      take,
    });
    return Promise.all(
      assets.map(async (asset) => {
        const activeLien = await this.findActiveLien(asset.fingerprint);
        return {
          ...this.serializeAsset(asset),
          isClean: !activeLien,
          activeLienId: activeLien?.id ?? null,
        };
      }),
    );
  }

  async exportAudit(
    fingerprint?: string,
    format: 'csv' | 'json' = 'csv',
    limit = 200,
  ) {
    const events = await this.listAudit(fingerprint, limit);
    if (format === 'json') {
      return {
        exportedAt: new Date().toISOString(),
        fingerprint: fingerprint?.toLowerCase() ?? null,
        count: events.length,
        events,
      };
    }

    const headings = [
      'eventId',
      'type',
      'fingerprint',
      'assetId',
      'createdAt',
      'payload',
    ];
    const rows = events.map((event) =>
      [
        event.id,
        event.type,
        event.fingerprint ?? '',
        event.assetId ?? '',
        new Date(event.createdAt).toISOString(),
        JSON.stringify(event.payload),
      ]
        .map((value) => this.escapeCsv(value))
        .join(','),
    );
    return [headings.join(','), ...rows].join('\n');
  }

  private resolveFingerprint(dto: CheckEncumbranceDto): string {
    if (dto.fingerprint) return dto.fingerprint.toLowerCase();
    if (dto.fields) {
      return createAssetFingerprint(this.toInvoiceFields(dto.fields));
    }
    throw new BadRequestException('Provide fingerprint or invoice fields');
  }

  private toInvoiceFields(
    input: InvoiceFields | CreateFingerprintDto | CheckEncumbranceDto['fields'],
  ): InvoiceFields {
    if (!input) {
      throw new BadRequestException('Invoice fields are required');
    }
    return {
      issuerCvi: input.issuerCvi,
      debtorCvi: input.debtorCvi,
      documentHash: input.documentHash,
      invoiceNumber: input.invoiceNumber,
      amount: input.amount,
      currency: (input.currency ?? 'USD').toUpperCase(),
      dueDate: input.dueDate,
    };
  }

  private async findActiveLien(fingerprint: string) {
    return this.liens.findOne({
      where: {
        fingerprint: fingerprint.toLowerCase(),
        status: 'active',
        priority: 1,
      },
    });
  }

  private async verifyParty({
    role,
    fingerprint,
    assetId,
    wallet,
    chain,
    atokenAddress,
  }: PartyVerificationInput): Promise<PartyVerificationEvidence> {
    const missing = [
      !wallet && 'wallet',
      !chain && 'chain',
      !atokenAddress && 'atokenAddress',
    ].filter((value): value is string => Boolean(value));

    if (missing.length > 0) {
      await this.rejectParty({
        role,
        fingerprint,
        assetId,
        wallet,
        chain,
        atokenAddress,
        code: 'CVI_INPUT_REQUIRED',
        message: `${this.titleCase(role)} verification requires ${missing.join(', ')}`,
        kind: 'input',
      });
    }

    try {
      const query = await this.cleanverse.queryApass({
        chain: chain!,
        address: wallet!,
      });
      const pass = query.data;
      const status = Number(pass?.status);
      const expirationTime =
        typeof pass?.expirationTime === 'number' ? pass.expirationTime : null;

      if (!pass || !Number.isFinite(status)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_NO_APASS',
          message: `${this.titleCase(role)} wallet has no queryable A-Pass`,
          kind: 'forbidden',
        });
      }

      if (expirationTime === null || !Number.isFinite(expirationTime)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_QUERY_MALFORMED',
          message: 'Cleanverse A-Pass response omitted a valid expiration time',
          kind: 'upstream',
        });
      }
      const verifiedExpirationTime = expirationTime as number;

      if (status === 2) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_FROZEN',
          message: `${this.titleCase(role)} A-Pass is frozen`,
          kind: 'forbidden',
        });
      }

      if (status !== 1) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_STATUS_INVALID',
          message: `${this.titleCase(role)} A-Pass is not active`,
          kind: 'forbidden',
        });
      }

      if (verifiedExpirationTime <= Math.floor(Date.now() / 1000)) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_EXPIRED',
          message: `${this.titleCase(role)} A-Pass has expired`,
          kind: 'forbidden',
        });
      }

      const verification = await this.cleanverse.verifyApass({
        chain: chain!,
        atoken: atokenAddress!,
        address: wallet!,
      });
      const verifyCode = Number(verification.data?.code);

      if (!Number.isFinite(verifyCode) || !isVerifyApassAllowed(verifyCode)) {
        const code = Number.isFinite(verifyCode)
          ? (verifyFailureCodes[verifyCode] ?? 'CVI_VERIFY_FAILED')
          : 'CVI_VERIFY_MALFORMED';
        const message = Number.isFinite(verifyCode)
          ? mapVerifyApassMessage(verifyCode)
          : 'Cleanverse returned a malformed verify_apass response';
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code,
          message: `${this.titleCase(role)} verification failed: ${message}`,
          kind: 'forbidden',
          cleanverseCode: Number.isFinite(verifyCode) ? verifyCode : null,
        });
      }

      const verifiedAt = new Date().toISOString();
      const evidence: PartyVerificationEvidence = {
        role,
        wallet: wallet!,
        chain: chain!,
        atokenAddress: atokenAddress!,
        cvRecordId: pass.cvRecordId ?? null,
        tier: pass.tier ?? null,
        subTier: pass.subTier ?? null,
        group: pass.group ?? null,
        status,
        expirationTime: verifiedExpirationTime,
        verifyCode,
        verifyMessage: mapVerifyApassMessage(verifyCode),
        verifiedAt,
      };

      await this.audit('CVI_VERIFIED', fingerprint, assetId, {
        ...evidence,
        atoken: evidence.atokenAddress,
      });
      return evidence;
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      if (error instanceof CleanverseConfigError) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_GATE_UNAVAILABLE',
          message: 'Cleanverse verification is not configured on the API',
          kind: 'unavailable',
        });
      }
      if (error instanceof CleanverseApiError) {
        await this.rejectParty({
          role,
          fingerprint,
          assetId,
          wallet,
          chain,
          atokenAddress,
          code: 'CVI_UPSTREAM_ERROR',
          message: `Cleanverse verification unavailable: ${error.message}`,
          kind: 'upstream',
          cleanverseCode: error.code,
        });
      }
      throw error;
    }
  }

  private async rejectParty(
    input: PartyVerificationInput & {
      code: string;
      message: string;
      kind: 'input' | 'forbidden' | 'unavailable' | 'upstream';
      cleanverseCode?: string | number | null;
    },
  ): Promise<never> {
    await this.audit(
      'CVI_VERIFICATION_FAILED',
      input.fingerprint,
      input.assetId,
      {
        role: input.role,
        wallet: input.wallet ?? null,
        chain: input.chain ?? null,
        atoken: input.atokenAddress ?? null,
        code: input.code,
        cleanverseCode: input.cleanverseCode ?? null,
      },
    );

    const body = {
      message: input.message,
      code: input.code,
      role: input.role,
    };
    if (input.kind === 'input') throw new BadRequestException(body);
    if (input.kind === 'unavailable') {
      throw new ServiceUnavailableException(body);
    }
    if (input.kind === 'upstream') throw new BadGatewayException(body);
    throw new ForbiddenException(body);
  }

  private titleCase(value: string) {
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  }

  private escapeCsv(value: string | number | boolean | null | undefined) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  private async audit(
    type: AuditEventEntity['type'],
    fingerprint: string | null,
    assetId: string | null,
    payload: Record<string, unknown>,
  ) {
    const now = Date.now();
    this.lastAuditTimestamp = Math.max(now, this.lastAuditTimestamp + 1);
    const event = this.audits.create({
      type,
      fingerprint: fingerprint?.toLowerCase() ?? null,
      assetId,
      payload,
      createdAt: new Date(this.lastAuditTimestamp),
    });
    await this.audits.save(event);
  }

  private assetFields(asset: AssetEntity): InvoiceFields {
    return {
      issuerCvi: asset.issuerCvi,
      debtorCvi: asset.debtorCvi,
      documentHash: asset.documentHash,
      invoiceNumber: asset.invoiceNumber,
      amount: asset.amount,
      currency: asset.currency,
      dueDate: asset.dueDate,
    };
  }

  private serializeAsset(asset: AssetEntity) {
    return {
      id: asset.id,
      fingerprint: asset.fingerprint,
      status: asset.status,
      fields: this.assetFields(asset),
      chain: asset.chain,
      issuerWallet: asset.issuerWallet,
      debtorWallet: asset.debtorWallet,
      atokenAddress: asset.atokenAddress,
      issuerVerification: asset.issuerVerification,
      issuerCviVerifiedAt: asset.issuerCviVerifiedAt,
      cvaId: asset.cvaId,
      cva: this.serializeCva(asset),
      createdAt: asset.createdAt,
      updatedAt: asset.updatedAt,
    };
  }

  private serializeCva(asset: AssetEntity) {
    return {
      requestId: asset.cvaRequestId,
      applyStatus: asset.cvaApplyStatus,
      atokenAddress: asset.cvaAtokenAddress,
      symbol: asset.cvaSymbol,
      name: asset.cvaName,
      txHash: asset.cvaTxHash,
      issuedAt: asset.cvaIssuedAt,
      explorerUrl: asset.cvaTxHash
        ? `https://sepolia.etherscan.io/tx/${asset.cvaTxHash}`
        : null,
    };
  }

  private resolveCvaAdminAddress(preferred?: string | null): string {
    if (preferred && isAddress(preferred)) return preferred;
    const configured = this.config.get<string>('cva.adminAddress') ?? '';
    if (configured && isAddress(configured)) return configured;
    const pk = this.config.get<string>('chain.privateKey') ?? '';
    if (pk) {
      const hex = (pk.startsWith('0x') ? pk : `0x${pk}`) as Hex;
      if (isHex(hex)) return privateKeyToAccount(hex).address;
    }
    throw new BadRequestException({
      message:
        'CVA admin address required. Connect an issuer wallet or set CVA_ADMIN_ADDRESS / CHAIN_PRIVATE_KEY.',
      code: 'CVA_ADMIN_REQUIRED',
    });
  }

  private buildCvaSymbol(asset: AssetEntity): string {
    const inv = asset.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    const suffix = randomBytes(2).toString('hex').toUpperCase();
    const base = (inv.slice(-6) || asset.fingerprint.slice(2, 8)).toUpperCase();
    return `LI${base}${suffix}`.slice(0, 12);
  }

  private async pollCvaUntilTerminal(asset: AssetEntity, maxAttempts?: number) {
    const attempts =
      maxAttempts ??
      this.config.get<number>('cva.pollAttempts') ??
      8;
    const intervalMs =
      this.config.get<number>('cva.pollIntervalMs') ?? 2500;
    const requestId = asset.cvaRequestId!;
    let lastStatus = asset.cvaApplyStatus ?? 'PENDING';

    for (let i = 0; i < attempts; i++) {
      try {
        const response = await this.cleanverse.queryApplyStatus(requestId);
        const data = response.data;
        lastStatus = data.applyStatus ?? lastStatus;
        asset.cvaApplyStatus = lastStatus;

        if (lastStatus === 'ISSUED') {
          asset.status = 'minted';
          asset.cvaAtokenAddress =
            data.atokenAddress ?? asset.cvaAtokenAddress;
          asset.cvaSymbol = data.tokenSymbol ?? asset.cvaSymbol;
          asset.cvaTxHash = data.txHash ?? asset.cvaTxHash;
          asset.cvaId = data.requestId ?? asset.cvaId;
          asset.cvaIssuedAt = data.issuedAt
            ? new Date(data.issuedAt)
            : new Date();
          await this.assets.save(asset);
          await this.audit('CVA_MINTED', asset.fingerprint, asset.id, {
            requestId,
            applyStatus: lastStatus,
            atokenAddress: asset.cvaAtokenAddress,
            symbol: asset.cvaSymbol,
            txHash: asset.cvaTxHash,
            chain: asset.chain,
          });
          return {
            fingerprint: asset.fingerprint,
            status: asset.status,
            cva: this.serializeCva(asset),
            alreadyIssued: false,
          };
        }

        if (lastStatus === 'REJECTED' || lastStatus === 'ISSUE_FAILED') {
          asset.status = 'clean';
          await this.assets.save(asset);
          await this.audit('CVA_ISSUE_FAILED', asset.fingerprint, asset.id, {
            requestId,
            applyStatus: lastStatus,
            rejectReason: data.rejectReason ?? null,
            issueErrorMsg: data.issueErrorMsg ?? null,
          });
          throw new BadGatewayException({
            message: `CVA issuance ${lastStatus}: ${
              data.rejectReason || data.issueErrorMsg || 'see Cleanverse status'
            }`,
            code: 'CVA_ISSUE_FAILED',
            applyStatus: lastStatus,
            requestId,
          });
        }

        await this.assets.save(asset);
      } catch (error) {
        if (
          error instanceof BadGatewayException ||
          error instanceof BadRequestException
        ) {
          throw error;
        }
        if (i === attempts - 1) {
          await this.assets.save(asset);
          break;
        }
      }

      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
      }
    }

    return {
      fingerprint: asset.fingerprint,
      status: asset.status,
      cva: this.serializeCva(asset),
      alreadyIssued: false,
      pending: true,
      message:
        'CVA issuance still processing. Poll GET /api/assets/:fingerprint/cva or POST status refresh.',
    };
  }

  private serializeLien(lien: LienEntity) {
    return {
      id: lien.id,
      fingerprint: lien.fingerprint,
      lenderCvi: lien.lenderCvi,
      lenderWallet: lien.lenderWallet,
      lenderVerification: lien.lenderVerification,
      lenderCviVerifiedAt: lien.lenderCviVerifiedAt,
      priority: lien.priority,
      status: lien.status,
      cvaId: lien.cvaId,
      txHash: lien.txHash,
      settlementChain: lien.settlementChain,
      registeredAt: lien.registeredAt,
    };
  }

  private resolveSettlementChain(
    lien: LienEntity | null,
    asset: AssetEntity | null,
  ): string | null {
    return (
      normalizeSettlementNetwork(lien?.settlementChain) ??
      normalizeSettlementNetwork(asset?.chain) ??
      null
    );
  }

  private buildBlockedMessage(input: {
    settlementChain: string | null;
    attemptedChain: string;
    crossChain: boolean;
  }): string {
    if (input.crossChain && input.settlementChain) {
      return `Financing blocked: this receivable already has a first-priority lien on ${formatNetworkLabel(input.settlementChain)}. Cross-chain re-pledge on ${formatNetworkLabel(input.attemptedChain)} is denied.`;
    }
    if (input.settlementChain) {
      return `Financing blocked: active first-priority lien already exists on ${formatNetworkLabel(input.settlementChain)}. The same fingerprint cannot be financed again on any network.`;
    }
    return 'Financing blocked: underlying asset already has a first-priority lien. The fingerprint is globally encumbered.';
  }

  private async rejectDuplicateFinance(input: {
    fingerprint: string;
    asset: AssetEntity;
    existing: LienEntity | null;
    attemptedChain: string;
    attemptedLenderCvi: string;
    attemptedLenderWallet?: string | null;
    lenderVerification?: PartyVerificationEvidence | null;
    source: 'registry' | 'on_chain';
    reason: string;
    onChainLender?: string | null;
    onChainRegisteredAt?: number | null;
    registryAddress?: string | null;
  }): Promise<ConflictException> {
    const settlementChain = this.resolveSettlementChain(
      input.existing,
      input.asset,
    );
    const crossChain = isCrossChainAttempt(
      settlementChain,
      input.attemptedChain,
    );
    const message = this.buildBlockedMessage({
      settlementChain,
      attemptedChain: input.attemptedChain,
      crossChain,
    });

    await this.audit('FINANCING_BLOCKED', input.fingerprint, input.asset.id, {
      attemptedLenderCvi: input.attemptedLenderCvi,
      attemptedLenderWallet: input.attemptedLenderWallet ?? null,
      attemptedChain: input.attemptedChain,
      settlementChain,
      crossChain,
      scope: 'global',
      existingLienId: input.existing?.id ?? null,
      existingLenderCvi: input.existing?.lenderCvi ?? null,
      onChainLender: input.onChainLender ?? null,
      reason: crossChain ? 'cross_chain_repledge' : input.reason,
      source: input.source,
    });

    return new ConflictException({
      message,
      code: 'FINANCING_BLOCKED',
      reason: crossChain ? 'CROSS_CHAIN_REPLEDGE' : 'DUPLICATE_FINANCING',
      fingerprint: input.fingerprint,
      scope: 'global',
      crossChain,
      attemptedChain: input.attemptedChain,
      settlementChain,
      source: input.source,
      existingLien: input.existing
        ? {
            id: input.existing.id,
            lenderCvi: input.existing.lenderCvi,
            priority: input.existing.priority,
            registeredAt: input.existing.registeredAt,
            cvaId: input.existing.cvaId,
            txHash: input.existing.txHash,
            settlementChain,
          }
        : {
            lender: input.onChainLender ?? null,
            registeredAt: input.onChainRegisteredAt ?? null,
            registryAddress: input.registryAddress ?? null,
            settlementChain,
          },
      lenderVerification: input.lenderVerification ?? null,
    });
  }
}
